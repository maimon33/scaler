// Pure replica-demand math shared by the reconciler and its tests.
// Nothing here talks to AWS or Kubernetes: source readers (controller/sources/*)
// produce a single numeric "source value"; this module turns that value into a
// bounded replica count using each Scaler definition's own headroom and limits.

/**
 * Convert a raw source reading (queue depth, metric value, alarm state …)
 * into a replica count before headroom or clamping.
 */
export function computeBaseDemand(sourceValue, targetPerReplica) {
  if (!Number.isFinite(sourceValue) || sourceValue < 0) {
    throw new RangeError('sourceValue must be a finite number >= 0');
  }
  if (!Number.isFinite(targetPerReplica) || targetPerReplica <= 0) {
    throw new RangeError('targetPerReplica must be a finite number > 0');
  }
  return Math.ceil(sourceValue / targetPerReplica);
}

/**
 * Add a Scaler definition's configured headroom on top of calculated demand.
 * Headroom always applies before the max/min clamp, per the README contract.
 */
export function applyHeadroom(desiredReplicas, headroom) {
  if (!headroom || headroom.type === 'none') return desiredReplicas;
  if (headroom.type === 'percent') {
    return Math.ceil(desiredReplicas * (1 + headroom.value / 100));
  }
  if (headroom.type === 'replicas') {
    return desiredReplicas + headroom.value;
  }
  throw new RangeError(`Unknown headroom type: ${headroom.type}`);
}

/** Bound a replica count to a definition's min/max range. */
export function clampReplicas(desiredReplicas, min, max) {
  return Math.min(max, Math.max(min, desiredReplicas));
}

/**
 * Full pipeline: source value -> base demand -> headroom -> clamp.
 * Mirrors the README: "first calculates source demand, adds the configured
 * headroom, and finally clamps the result to the min/max range."
 */
export function resolveDesiredReplicas({
  sourceValue,
  targetPerReplica,
  headroom,
  min,
  max,
}) {
  const base = computeBaseDemand(sourceValue, targetPerReplica);
  const withHeadroom = applyHeadroom(base, headroom);
  return clampReplicas(withHeadroom, min, max);
}

/**
 * Decide what to do when a source read fails, per the definition's
 * `onSourceFailure` policy.
 *
 * - `hold-current` (default): make no change; returns null.
 * - `floor`: scale to the configured safe replica count.
 *
 * Never throws on an unknown strategy — it falls back to hold-current so a
 * bad config can't turn a source outage into an unplanned scale action.
 */
export function resolveFailurePolicy(policy) {
  if (policy?.strategy === 'floor') return policy.replicas;
  return null;
}
