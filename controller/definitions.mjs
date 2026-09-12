// Validation and Postgres access for Scaler definitions — the persisted form
// of the scaler.io/v1alpha1 contract the UI's YAML tab edits. The reconciler
// reads these rows to know what to poll and how to bound the result; the
// /v1/definitions API in server.mjs lets an operator or CI pipeline manage
// them without a direct database connection.
import { validateSource } from './triggers.mjs';

export class ValidationError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

function requiredString(source, key, maxLength = 200) {
  const value = source?.[key];
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

function normalizeHeadroom(headroom, problems) {
  if (!headroom || headroom.type === undefined || headroom.type === 'none') {
    return { type: 'none', value: 0 };
  }
  if (headroom.type === 'percent' || headroom.type === 'replicas') {
    if (!Number.isFinite(headroom.value) || headroom.value < 0) {
      problems.push('replicas.headroom.value must be a number >= 0');
      return { type: headroom.type, value: 0 };
    }
    return { type: headroom.type, value: headroom.value };
  }
  problems.push('replicas.headroom.type must be percent, replicas, or none');
  return { type: 'none', value: 0 };
}

function normalizeFailurePolicy(policy, problems) {
  if (
    !policy ||
    policy.strategy === undefined ||
    policy.strategy === 'hold-current'
  ) {
    return { strategy: 'hold-current' };
  }
  if (policy.strategy === 'floor') {
    if (!Number.isInteger(policy.replicas) || policy.replicas < 0) {
      problems.push(
        'behavior.onSourceFailure.replicas must be an integer >= 0 for the floor strategy',
      );
      return { strategy: 'floor', replicas: 0 };
    }
    return { strategy: 'floor', replicas: policy.replicas };
  }
  problems.push(
    'behavior.onSourceFailure.strategy must be hold-current or floor',
  );
  return { strategy: 'hold-current' };
}

/**
 * Validates and normalizes the scaler.io/v1alpha1 contract (as parsed JSON —
 * YAML-to-JSON conversion happens at the API boundary) into a flat row ready
 * for `upsertDefinition`. Throws ValidationError with every problem found,
 * rather than just the first, so a GitOps pipeline gets a complete report.
 */
export function normalizeDefinition(payload) {
  const problems = [];

  const name = requiredString(payload, 'name', 100);
  if (!name) problems.push('name is required');
  const namespace = requiredString(payload, 'namespace', 100);
  if (!namespace) problems.push('namespace is required');

  const targetRef = payload?.targetRef ?? {};
  const targetKind =
    targetRef.kind === 'StatefulSet' ? 'StatefulSet' : 'Deployment';
  const targetName = requiredString(targetRef, 'name', 200);
  if (!targetName) problems.push('targetRef.name is required');

  const replicas = payload?.replicas ?? {};
  const min =
    Number.isInteger(replicas.min) && replicas.min >= 0 ? replicas.min : null;
  const max =
    Number.isInteger(replicas.max) && replicas.max >= 1 ? replicas.max : null;
  if (min === null) problems.push('replicas.min must be an integer >= 0');
  if (max === null) problems.push('replicas.max must be an integer >= 1');
  if (min !== null && max !== null && min > max) {
    problems.push('replicas.min must be <= replicas.max');
  }
  const headroom = normalizeHeadroom(replicas.headroom, problems);

  const source = payload?.source ?? { type: 'manual', config: {} };
  problems.push(...validateSource(source));

  const onSourceFailure = normalizeFailurePolicy(
    payload?.behavior?.onSourceFailure,
    problems,
  );

  if (problems.length > 0) throw new ValidationError(problems);

  return {
    name,
    namespace,
    target_kind: targetKind,
    target_name: targetName,
    min_replicas: min,
    max_replicas: max,
    headroom,
    source_type: source.type,
    source_config: source.config ?? {},
    on_source_failure: onSourceFailure,
    enabled: payload?.enabled !== false,
  };
}

export async function ensureDefinitionsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scaler_definitions (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      namespace TEXT NOT NULL,
      target_kind TEXT NOT NULL DEFAULT 'Deployment',
      target_name TEXT NOT NULL,
      min_replicas INTEGER NOT NULL CHECK (min_replicas >= 0),
      max_replicas INTEGER NOT NULL CHECK (max_replicas >= 1),
      headroom JSONB NOT NULL DEFAULT '{"type":"none","value":0}'::jsonb,
      source_type TEXT NOT NULL,
      source_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      on_source_failure JSONB NOT NULL DEFAULT '{"strategy":"hold-current"}'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (namespace, name)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_source_state (
      definition_id BIGINT PRIMARY KEY REFERENCES scaler_definitions(id) ON DELETE CASCADE,
      event_count INTEGER NOT NULL DEFAULT 0,
      last_event_at TIMESTAMPTZ
    )
  `);
}

export async function listDefinitions(pool, { enabledOnly = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM scaler_definitions WHERE ($1::boolean = FALSE OR enabled = TRUE) ORDER BY namespace, name`,
    [enabledOnly],
  );
  return result.rows;
}

export async function upsertDefinition(pool, definition) {
  const result = await pool.query(
    `INSERT INTO scaler_definitions (
       name, namespace, target_kind, target_name, min_replicas, max_replicas,
       headroom, source_type, source_config, on_source_failure, enabled
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (namespace, name) DO UPDATE SET
       target_kind = EXCLUDED.target_kind,
       target_name = EXCLUDED.target_name,
       min_replicas = EXCLUDED.min_replicas,
       max_replicas = EXCLUDED.max_replicas,
       headroom = EXCLUDED.headroom,
       source_type = EXCLUDED.source_type,
       source_config = EXCLUDED.source_config,
       on_source_failure = EXCLUDED.on_source_failure,
       enabled = EXCLUDED.enabled,
       updated_at = NOW()
     RETURNING *`,
    [
      definition.name,
      definition.namespace,
      definition.target_kind,
      definition.target_name,
      definition.min_replicas,
      definition.max_replicas,
      definition.headroom,
      definition.source_type,
      definition.source_config,
      definition.on_source_failure,
      definition.enabled,
    ],
  );
  return result.rows[0];
}

export async function deleteDefinition(pool, namespace, name) {
  const result = await pool.query(
    'DELETE FROM scaler_definitions WHERE namespace = $1 AND name = $2',
    [namespace, name],
  );
  return result.rowCount > 0;
}

/**
 * Records one push-trigger event (e.g. an EventBridge -> webhook S3 "Object
 * Created" notification) for a definition.
 */
export async function recordPushEvent(pool, definitionId) {
  await pool.query(
    `INSERT INTO push_source_state (definition_id, event_count, last_event_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (definition_id) DO UPDATE SET
       event_count = push_source_state.event_count + 1,
       last_event_at = NOW()`,
    [definitionId],
  );
}

/**
 * Reads a push trigger's current demand: the accumulated event count, or 0
 * once `decaySeconds` have passed since the last event. Decay is evaluated
 * at read time rather than by a separate timer, so it stays correct even if
 * the reconciler was not running when the window closed.
 */
export async function readPushEventCount(pool, definitionId, decaySeconds) {
  const result = await pool.query(
    `SELECT event_count, last_event_at FROM push_source_state WHERE definition_id = $1`,
    [definitionId],
  );
  const row = result.rows[0];
  if (!row || !row.last_event_at) return 0;
  const ageSeconds =
    (Date.now() - new Date(row.last_event_at).getTime()) / 1000;
  return ageSeconds > decaySeconds ? 0 : row.event_count;
}
