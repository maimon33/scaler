import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHeadroom,
  clampReplicas,
  computeBaseDemand,
  resolveDesiredReplicas,
  resolveFailurePolicy,
} from './demand.mjs';

test('computeBaseDemand rounds up partial replicas', () => {
  assert.equal(computeBaseDemand(101, 50), 3);
  assert.equal(computeBaseDemand(100, 50), 2);
  assert.equal(computeBaseDemand(0, 50), 0);
});

test('computeBaseDemand rejects invalid inputs', () => {
  assert.throws(() => computeBaseDemand(-1, 50), RangeError);
  assert.throws(() => computeBaseDemand(10, 0), RangeError);
  assert.throws(() => computeBaseDemand(Number.NaN, 50), RangeError);
});

test('applyHeadroom adds percentage headroom and rounds up', () => {
  assert.equal(applyHeadroom(10, { type: 'percent', value: 20 }), 12);
  assert.equal(applyHeadroom(3, { type: 'percent', value: 10 }), 4);
});

test('applyHeadroom adds a fixed replica count', () => {
  assert.equal(applyHeadroom(10, { type: 'replicas', value: 3 }), 13);
});

test('applyHeadroom passes demand through unchanged when disabled', () => {
  assert.equal(applyHeadroom(10, { type: 'none' }), 10);
  assert.equal(applyHeadroom(10, undefined), 10);
});

test('applyHeadroom rejects an unknown type', () => {
  assert.throws(() => applyHeadroom(10, { type: 'bogus' }), RangeError);
});

test('clampReplicas bounds to min/max', () => {
  assert.equal(clampReplicas(1, 2, 80), 2);
  assert.equal(clampReplicas(90, 2, 80), 80);
  assert.equal(clampReplicas(12, 2, 80), 12);
});

test('resolveDesiredReplicas runs demand, headroom, and clamp in order', () => {
  // 8200 messages / 50 per replica = 164, +20% headroom = 197, clamped to 80.
  assert.equal(
    resolveDesiredReplicas({
      sourceValue: 8200,
      targetPerReplica: 50,
      headroom: { type: 'percent', value: 20 },
      min: 2,
      max: 80,
    }),
    80,
  );

  // Below min: 40 messages / 50 per replica = 1, clamped up to the min of 2.
  assert.equal(
    resolveDesiredReplicas({
      sourceValue: 40,
      targetPerReplica: 50,
      headroom: { type: 'none' },
      min: 2,
      max: 80,
    }),
    2,
  );
});

test('resolveFailurePolicy holds current replicas by default', () => {
  assert.equal(resolveFailurePolicy(undefined), null);
  assert.equal(resolveFailurePolicy({ strategy: 'hold-current' }), null);
});

test('resolveFailurePolicy floors to the configured safe replica count', () => {
  assert.equal(resolveFailurePolicy({ strategy: 'floor', replicas: 6 }), 6);
});

test('resolveFailurePolicy falls back to hold-current on an unknown strategy', () => {
  assert.equal(resolveFailurePolicy({ strategy: 'bogus', replicas: 6 }), null);
});
