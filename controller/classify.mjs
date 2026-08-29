const FINAL_STATUSES = new Set(['succeeded', 'failed', 'timed_out']);

export function inferDirection(previousReplicas, desiredReplicas) {
  if (desiredReplicas > previousReplicas) return 'up';
  if (desiredReplicas < previousReplicas) return 'down';
  return 'unchanged';
}

export function classifyOperation(operation, durationThresholdSeconds) {
  const reasons = [];
  const direction = inferDirection(
    operation.previous_replicas ?? operation.desired_replicas,
    operation.desired_replicas,
  );
  const durationMs = operation.duration_ms ?? 0;

  if (operation.status === 'failed') {
    reasons.push(
      direction === 'up'
        ? 'SCALE_UP_FAILED'
        : direction === 'down'
          ? 'SCALE_DOWN_FAILED'
          : 'SCALE_FAILED',
    );
  }
  if (operation.status === 'timed_out') {
    reasons.push(
      direction === 'up'
        ? 'SCALE_UP_TIMED_OUT'
        : direction === 'down'
          ? 'SCALE_DOWN_TIMED_OUT'
          : 'SCALE_TIMED_OUT',
    );
  }
  if (
    FINAL_STATUSES.has(operation.status) &&
    durationMs > durationThresholdSeconds * 1000
  ) {
    reasons.push('SCALE_DURATION_EXCEEDED');
  }
  if (
    operation.status === 'succeeded' &&
    Number.isInteger(operation.actual_replicas) &&
    operation.actual_replicas !== operation.desired_replicas
  ) {
    reasons.push('REPLICA_TARGET_MISMATCH');
  }

  return {
    critical: reasons.length > 0,
    direction,
    reasons: [...new Set(reasons)],
  };
}

export function criticalTitle(operation, classification) {
  const direction =
    classification.direction === 'unchanged'
      ? 'scale'
      : `scale-${classification.direction}`;
  if (operation.status === 'failed') return `${direction} failed`;
  if (operation.status === 'timed_out') return `${direction} timed out`;
  if (classification.reasons.includes('REPLICA_TARGET_MISMATCH'))
    return `${direction} missed its replica target`;
  return `${direction} exceeded its duration threshold`;
}
