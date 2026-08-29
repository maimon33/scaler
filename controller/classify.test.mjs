import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOperation, inferDirection } from './classify.mjs';

test('infers scale direction', () => {
  assert.equal(inferDirection(2, 5), 'up');
  assert.equal(inferDirection(5, 2), 'down');
  assert.equal(inferDirection(3, 3), 'unchanged');
});

test('marks a failed scale-up as critical', () => {
  assert.deepEqual(
    classifyOperation(
      {
        previous_replicas: 2,
        desired_replicas: 5,
        status: 'failed',
        duration_ms: 1200,
      },
      10,
    ),
    { critical: true, direction: 'up', reasons: ['SCALE_UP_FAILED'] },
  );
});

test('marks a slow successful operation as critical', () => {
  const result = classifyOperation(
    {
      previous_replicas: 2,
      desired_replicas: 5,
      actual_replicas: 5,
      status: 'succeeded',
      duration_ms: 11001,
    },
    10,
  );
  assert.equal(result.critical, true);
  assert.deepEqual(result.reasons, ['SCALE_DURATION_EXCEEDED']);
});

test('marks a successful operation with a replica mismatch as critical', () => {
  const result = classifyOperation(
    {
      previous_replicas: 2,
      desired_replicas: 5,
      actual_replicas: 4,
      status: 'succeeded',
      duration_ms: 9000,
    },
    10,
  );
  assert.deepEqual(result.reasons, ['REPLICA_TARGET_MISMATCH']);
});

test('leaves a timely successful operation non-critical', () => {
  const result = classifyOperation(
    {
      previous_replicas: 2,
      desired_replicas: 5,
      actual_replicas: 5,
      status: 'succeeded',
      duration_ms: 9000,
    },
    10,
  );
  assert.deepEqual(result, { critical: false, direction: 'up', reasons: [] });
});
