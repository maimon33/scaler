// Minimal Kubernetes REST client: no @kubernetes/client-node dependency,
// just enough to read/patch the /scale subresource and discover a native
// HPA, matching the "use Kubernetes primitives first" design rule. Supports
// the same two modes the README documents for local development vs in-cluster
// use: an unauthenticated kube-proxy URL, or the Pod's own service-account
// token and CA bundle.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const SERVICE_ACCOUNT_DIR = '/var/run/secrets/kubernetes.io/serviceaccount';

export class KubeApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Kubernetes API returned HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function loadInClusterConfig() {
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT ?? '443';
  if (!host) {
    throw new Error(
      'Not running in-cluster and KUBE_PROXY_URL is not set. Run `kubectl proxy` for local development.',
    );
  }
  return {
    baseUrl: `https://${host}:${port}`,
    token: fs.readFileSync(`${SERVICE_ACCOUNT_DIR}/token`, 'utf8').trim(),
    ca: fs.readFileSync(`${SERVICE_ACCOUNT_DIR}/ca.crt`),
  };
}

/**
 * Build a client from KUBE_PROXY_URL (local dev; kube-proxy already
 * authenticates) or the Pod's own service-account identity (in-cluster).
 * Never use kube-proxy in production — see README "Local kube-proxy access".
 */
export function createKubeClient({
  proxyUrl = process.env.KUBE_PROXY_URL,
} = {}) {
  if (proxyUrl) return { baseUrl: proxyUrl, token: null, ca: null };
  return loadInClusterConfig();
}

function request(kubeClient, method, path, body) {
  const url = new URL(path, kubeClient.baseUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const payload = body ? JSON.stringify(body) : undefined;
  const contentType =
    method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';

  return new Promise((resolve, reject) => {
    const request_ = transport.request(
      url,
      {
        method,
        ca: kubeClient.ca,
        headers: {
          accept: 'application/json',
          'content-type': contentType,
          ...(kubeClient.token
            ? { authorization: `Bearer ${kubeClient.token}` }
            : {}),
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            // Non-JSON error bodies are surfaced via KubeApiError below.
          }
          const status = response.statusCode ?? 0;
          if (status >= 200 && status < 300) resolve(parsed);
          else reject(new KubeApiError(status, parsed));
        });
      },
    );
    request_.on('error', reject);
    if (payload) request_.write(payload);
    request_.end();
  });
}

function scalePath({ namespace, kind, name }) {
  const plural = kind === 'StatefulSet' ? 'statefulsets' : 'deployments';
  return `/apis/apps/v1/namespaces/${namespace}/${plural}/${name}/scale`;
}

/** Reads a Deployment or StatefulSet's current .spec/.status.replicas. */
export async function getScale(kubeClient, target) {
  return request(kubeClient, 'GET', scalePath(target));
}

/** Writes the /scale subresource — Scaler never edits the workload directly. */
export async function patchScale(kubeClient, target, replicas) {
  return request(kubeClient, 'PATCH', scalePath(target), {
    spec: { replicas },
  });
}

/**
 * Ownership guard: returns the native HPA targeting this workload, or null.
 * Scaler is read-only here by design — see the README's "Never create two
 * owners" rule.
 */
export async function findOwningHpa(kubeClient, { namespace, kind, name }) {
  const list = await request(
    kubeClient,
    'GET',
    `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`,
  );
  const items = list?.items ?? [];
  return (
    items.find(
      (hpa) =>
        hpa.spec?.scaleTargetRef?.kind === kind &&
        hpa.spec?.scaleTargetRef?.name === name,
    ) ?? null
  );
}
