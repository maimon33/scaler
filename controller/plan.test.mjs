import assert from 'node:assert/strict';
import test from 'node:test';
import { planReconciliation } from './plan.mjs';

const baseDefinition = {
  enabled: true,
  min_replicas: 2,
  max_replicas: 80,
  on_source_failure: { strategy: 'floor', replicas: 6 },
};

test('never writes to a workload owned by a native HPA', () => {
  const result = planReconciliation({
    definition: baseDefinition,
    currentReplicas: 12,
    owningHpa: { metadata: { name: 'checkout-api' } },
    demand: { status: 'resolved', desiredReplicas: 24 },
  });
  assert.deepEqual(result, {
    action: 'skip',
    reason: 'owned_by_hpa',
    desiredReplicas: 12,
  });
});

test('skips a disabled definition', () => {
  const result = planReconciliation({
    definition: { ...baseDefinition, enabled: false },
    currentReplicas: 12,
    owningHpa: null,
    demand: { status: 'resolved', desiredReplicas: 24 },
  });
  assert.equal(result.action, 'skip');
  assert.equal(result.reason, 'disabled');
});

test('skips unsupported trigger modes (manual, schedule) with their reason', () => {
  const result = planReconciliation({
    definition: baseDefinition,
    currentReplicas: 12,
    owningHpa: null,
    demand: { status: 'unsupported', reason: 'manual_source' },
  });
  assert.deepEqual(result, {
    action: 'skip',
    reason: 'manual_source',
    desiredReplicas: 12,
  });
});

test('scales when resolved demand differs from current replicas', () => {
  const result = planReconciliation({
    definition: baseDefinition,
    currentReplicas: 18,
    owningHpa: null,
    demand: { status: 'resolved', desiredReplicas: 24 },
  });
  assert.deepEqual(result, {
    action: 'scale',
    reason: 'demand_changed',
    desiredReplicas: 24,
  });
});

test('is a no-op when resolved demand already matches current replicas', () => {
  const result = planReconciliation({
    definition: baseDefinition,
    currentReplicas: 24,
    owningHpa: null,
    demand: { status: 'resolved', desiredReplicas: 24 },
  });
  assert.deepEqual(result, {
    action: 'skip',
    reason: 'already_at_target',
    desiredReplicas: 24,
  });
});

test('applies the floor failure policy on a source error', () => {
  const result = planReconciliation({
    definition: baseDefinition,
    currentReplicas: 18,
    owningHpa: null,
    demand: { status: 'source_error' },
  });
  assert.deepEqual(result, {
    action: 'scale',
    reason: 'source_failure_floor',
    desiredReplicas: 6,
  });
});

test('holds current replicas on a source error when the policy is hold-current', () => {
  const result = planReconciliation({
    definition: {
      ...baseDefinition,
      on_source_failure: { strategy: 'hold-current' },
    },
    currentReplicas: 18,
    owningHpa: null,
    demand: { status: 'source_error' },
  });
  assert.deepEqual(result, {
    action: 'skip',
    reason: 'source_failure_hold_current',
    desiredReplicas: 18,
  });
});

test('clamps the failure floor to the definition max', () => {
  const result = planReconciliation({
    definition: {
      ...baseDefinition,
      on_source_failure: { strategy: 'floor', replicas: 999 },
    },
    currentReplicas: 18,
    owningHpa: null,
    demand: { status: 'source_error' },
  });
  assert.deepEqual(result, {
    action: 'scale',
    reason: 'source_failure_floor',
    desiredReplicas: 80,
  });
});
