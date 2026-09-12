import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { KubeApiError, findOwningHpa, getScale, patchScale } from './k8s.mjs';

// Exercises the client against a real (plain HTTP) server standing in for
// `kubectl proxy`, rather than mocking fetch/http internals — this catches
// URL-building and status-code-handling mistakes a mock would hide.
async function withFakeApiServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('getScale requests the deployment scale subresource', async () => {
  const seen = [];
  await withFakeApiServer(
    (request, response) => {
      seen.push({ method: request.method, url: request.url });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ spec: { replicas: 18 }, status: { replicas: 18 } }),
      );
    },
    async (baseUrl) => {
      const result = await getScale(
        { baseUrl, token: null, ca: null },
        { namespace: 'production', kind: 'Deployment', name: 'events-worker' },
      );
      assert.equal(result.spec.replicas, 18);
    },
  );
  assert.deepEqual(seen, [
    {
      method: 'GET',
      url: '/apis/apps/v1/namespaces/production/deployments/events-worker/scale',
    },
  ]);
});

test('getScale uses the statefulsets plural for StatefulSet targets', async () => {
  const seen = [];
  await withFakeApiServer(
    (request, response) => {
      seen.push(request.url);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    },
    async (baseUrl) => {
      await getScale(
        { baseUrl, token: null, ca: null },
        { namespace: 'jobs', kind: 'StatefulSet', name: 'pdf-renderer' },
      );
    },
  );
  assert.deepEqual(seen, [
    '/apis/apps/v1/namespaces/jobs/statefulsets/pdf-renderer/scale',
  ]);
});

test('patchScale sends a merge-patch with the desired replica count', async () => {
  let received;
  await withFakeApiServer(
    (request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        received = {
          method: request.method,
          contentType: request.headers['content-type'],
          body: JSON.parse(body),
        };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ spec: { replicas: 24 } }));
      });
    },
    async (baseUrl) => {
      await patchScale(
        { baseUrl, token: null, ca: null },
        { namespace: 'production', kind: 'Deployment', name: 'events-worker' },
        24,
      );
    },
  );
  assert.equal(received.method, 'PATCH');
  assert.equal(received.contentType, 'application/merge-patch+json');
  assert.deepEqual(received.body, { spec: { replicas: 24 } });
});

test('findOwningHpa matches on scaleTargetRef kind and name', async () => {
  await withFakeApiServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          items: [
            {
              metadata: { name: 'other' },
              spec: { scaleTargetRef: { kind: 'Deployment', name: 'other' } },
            },
            {
              metadata: { name: 'checkout-api' },
              spec: {
                scaleTargetRef: { kind: 'Deployment', name: 'checkout-api' },
              },
            },
          ],
        }),
      );
    },
    async (baseUrl) => {
      const hpa = await findOwningHpa(
        { baseUrl, token: null, ca: null },
        { namespace: 'production', kind: 'Deployment', name: 'checkout-api' },
      );
      assert.equal(hpa.metadata.name, 'checkout-api');
    },
  );
});

test('findOwningHpa returns null when no HPA targets the workload', async () => {
  await withFakeApiServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ items: [] }));
    },
    async (baseUrl) => {
      const hpa = await findOwningHpa(
        { baseUrl, token: null, ca: null },
        { namespace: 'production', kind: 'Deployment', name: 'events-worker' },
      );
      assert.equal(hpa, null);
    },
  );
});

test('a non-2xx response is surfaced as a KubeApiError', async () => {
  await withFakeApiServer(
    (_request, response) => {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ message: 'deployments.apps "missing" not found' }),
      );
    },
    async (baseUrl) => {
      await assert.rejects(
        () =>
          getScale(
            { baseUrl, token: null, ca: null },
            { namespace: 'production', kind: 'Deployment', name: 'missing' },
          ),
        (error) => {
          assert.ok(error instanceof KubeApiError);
          assert.equal(error.status, 404);
          assert.match(error.message, /not found/);
          return true;
        },
      );
    },
  );
});
