import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationError, normalizeDefinition } from './definitions.mjs';

const validPayload = {
  name: 'events-worker-sqs',
  namespace: 'production',
  targetRef: { kind: 'Deployment', name: 'events-worker' },
  replicas: {
    min: 2,
    max: 80,
    headroom: { type: 'percent', value: 20 },
  },
  source: {
    type: 'aws-sqs',
    config: {
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
      targetMessagesPerReplica: 50,
    },
  },
  behavior: { onSourceFailure: { strategy: 'floor', replicas: 6 } },
};

test('normalizes a complete, valid definition', () => {
  const definition = normalizeDefinition(validPayload);
  assert.equal(definition.name, 'events-worker-sqs');
  assert.equal(definition.target_kind, 'Deployment');
  assert.equal(definition.min_replicas, 2);
  assert.equal(definition.max_replicas, 80);
  assert.deepEqual(definition.headroom, { type: 'percent', value: 20 });
  assert.equal(definition.source_type, 'aws-sqs');
  assert.deepEqual(definition.on_source_failure, {
    strategy: 'floor',
    replicas: 6,
  });
  assert.equal(definition.enabled, true);
});

test('defaults to no headroom, hold-current, and manual source', () => {
  const definition = normalizeDefinition({
    name: 'pdf-renderer-manual',
    namespace: 'jobs',
    targetRef: { kind: 'StatefulSet', name: 'pdf-renderer' },
    replicas: { min: 0, max: 30 },
  });
  assert.deepEqual(definition.headroom, { type: 'none', value: 0 });
  assert.deepEqual(definition.on_source_failure, { strategy: 'hold-current' });
  assert.equal(definition.source_type, 'manual');
});

test('collects every missing/invalid field instead of failing on the first', () => {
  assert.throws(
    () => normalizeDefinition({}),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.ok(error.problems.includes('name is required'));
      assert.ok(error.problems.includes('namespace is required'));
      assert.ok(error.problems.includes('targetRef.name is required'));
      assert.ok(
        error.problems.includes('replicas.min must be an integer >= 0'),
      );
      assert.ok(
        error.problems.includes('replicas.max must be an integer >= 1'),
      );
      return true;
    },
  );
});

test('rejects min greater than max', () => {
  assert.throws(
    () =>
      normalizeDefinition({
        ...validPayload,
        replicas: { ...validPayload.replicas, min: 90 },
      }),
    (error) => error.problems.includes('replicas.min must be <= replicas.max'),
  );
});

test('rejects an invalid source for its trigger type', () => {
  assert.throws(
    () =>
      normalizeDefinition({
        ...validPayload,
        source: { type: 'aws-sqs', config: {} },
      }),
    (error) =>
      error.problems.includes(
        'source.config.queueUrl is required for aws-sqs',
      ) &&
      error.problems.includes(
        'source.config.targetMessagesPerReplica is required for aws-sqs',
      ),
  );
});

test('rejects an unknown headroom type', () => {
  assert.throws(
    () =>
      normalizeDefinition({
        ...validPayload,
        replicas: {
          ...validPayload.replicas,
          headroom: { type: 'bogus', value: 1 },
        },
      }),
    (error) =>
      error.problems.includes(
        'replicas.headroom.type must be percent, replicas, or none',
      ),
  );
});

test('rejects an unknown source-failure strategy', () => {
  assert.throws(
    () =>
      normalizeDefinition({
        ...validPayload,
        behavior: { onSourceFailure: { strategy: 'bogus' } },
      }),
    (error) =>
      error.problems.includes(
        'behavior.onSourceFailure.strategy must be hold-current or floor',
      ),
  );
});

test('enabled defaults to true and honors an explicit false', () => {
  assert.equal(normalizeDefinition(validPayload).enabled, true);
  assert.equal(
    normalizeDefinition({ ...validPayload, enabled: false }).enabled,
    false,
  );
});
