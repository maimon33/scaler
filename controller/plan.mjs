// Pure reconciliation decision: given a definition, its workload's current
// replica count, whether another controller owns it, and the demand already
// resolved from its source (see reconciler.mjs for how that's computed),
// decide whether to scale and why. Kept free of any I/O so it can be tested
// without a cluster, a database, or AWS credentials.
import { clampReplicas, resolveFailurePolicy } from './demand.mjs';

function skip(reason, desiredReplicas) {
  return { action: 'skip', reason, desiredReplicas };
}

/**
 * @param {object} definition - a normalized scaler_definitions row
 * @param {number} currentReplicas - the workload's current .spec.replicas
 * @param {object|null} owningHpa - a native HPA targeting this workload, if any
 * @param {object} demand - one of:
 *   { status: 'resolved', desiredReplicas: number } - the source produced a value
 *   { status: 'source_error' }                       - the source read failed
 *   { status: 'unsupported', reason: string }         - this trigger type isn't
 *     polled by the reconciler (e.g. a schedule, which the dedicated
 *     scheduler owns) or the source is manual-only
 */
export function planReconciliation({
  definition,
  currentReplicas,
  owningHpa,
  demand,
}) {
  // Never write to a workload another controller already owns.
  if (owningHpa) return skip('owned_by_hpa', currentReplicas);
  if (!definition.enabled) return skip('disabled', currentReplicas);
  if (demand.status === 'unsupported')
    return skip(demand.reason, currentReplicas);

  let desiredReplicas;
  let reason;
  if (demand.status === 'resolved') {
    desiredReplicas = demand.desiredReplicas;
    reason = 'demand_changed';
  } else {
    const floor = resolveFailurePolicy(definition.on_source_failure);
    if (floor === null)
      return skip('source_failure_hold_current', currentReplicas);
    desiredReplicas = clampReplicas(
      floor,
      definition.min_replicas,
      definition.max_replicas,
    );
    reason = 'source_failure_floor';
  }

  if (desiredReplicas === currentReplicas) {
    return skip('already_at_target', desiredReplicas);
  }
  return { action: 'scale', reason, desiredReplicas };
}
