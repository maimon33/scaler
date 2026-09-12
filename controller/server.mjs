import { randomUUID, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import process from 'node:process';
import pg from 'pg';
import {
  ensureAwsRoleConfigSchema,
  getAwsRoleConfig,
  recordVerification,
  saveAwsRoleArn,
} from './aws-role-config.mjs';
import { classifyOperation, criticalTitle } from './classify.mjs';
import {
  deleteDefinition,
  ensureDefinitionsSchema,
  listDefinitions,
  normalizeDefinition,
  recordPushEvent,
  upsertDefinition,
  ValidationError,
} from './definitions.mjs';
import { integerEnv } from './env.mjs';
import { createLogger } from './log.mjs';
import { readCallerIdentity } from './sources/sts.mjs';
import {
  buildStackParameters,
  callerMatchesRole,
  isValidRoleArn,
  summarizeTriggerUsage,
} from './trigger-role.mjs';
import { TRIGGER_CATALOG } from './triggers.mjs';

const { Pool } = pg;
const port = integerEnv('EVENTS_PORT', 3001);
const durationThresholdSeconds = integerEnv(
  'CRITICAL_SCALE_DURATION_SECONDS',
  10,
);
const notificationCooldownSeconds = integerEnv(
  'SLACK_NOTIFICATION_COOLDOWN_SECONDS',
  300,
);
const historyDefaultDays = integerEnv('HISTORY_RETENTION_DAYS', 90);
const apiToken = process.env.SCALER_EVENTS_TOKEN ?? '';
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL?.trim() ?? '';
const allowedOrigin = process.env.EVENTS_ALLOWED_ORIGIN?.trim() ?? '';
const criticalLogMarker =
  process.env.CRITICAL_LOG_MARKER?.trim() || 'SCALER_CRITICAL';
const criticalLogEmphasis =
  process.env.CRITICAL_LOG_EMPHASIS?.trim() || '!!! CRITICAL SCALING ISSUE !!!';

if (
  process.env.NODE_ENV === 'production' &&
  (!apiToken || apiToken === 'CHANGE_ME')
) {
  throw new Error('SCALER_EVENTS_TOKEN must be set to a non-placeholder value');
}

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: integerEnv('DATABASE_PORT', 5432),
  database: process.env.DATABASE_NAME ?? 'scaler',
  user: process.env.DATABASE_USER ?? 'scaler',
  password: process.env.DATABASE_PASSWORD,
  max: integerEnv('DATABASE_POOL_SIZE', 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) =>
  log('error', 'DATABASE_POOL_ERROR', { error: error.message }),
);

const log = createLogger({
  criticalMarker: criticalLogMarker,
  criticalEmphasis: criticalLogEmphasis,
});

function authorized(request) {
  if (!apiToken && process.env.NODE_ENV !== 'production') return true;
  const supplied =
    request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBuffer = Buffer.from(apiToken);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function responseHeaders() {
  return {
    'content-type': 'application/json; charset=utf-8',
    ...(allowedOrigin
      ? { 'access-control-allow-origin': allowedOrigin, vary: 'Origin' }
      : {}),
  };
}

function send(response, status, payload) {
  response.writeHead(status, responseHeaders());
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65_536)
      throw new HttpError(413, 'Request body is too large');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requiredString(payload, key, maxLength = 200) {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, `${key} is required`);
  return value.trim().slice(0, maxLength);
}

function optionalInteger(payload, key, minimum = 0) {
  if (payload[key] === undefined || payload[key] === null) return null;
  if (!Number.isInteger(payload[key]) || payload[key] < minimum)
    throw new HttpError(400, `${key} must be an integer >= ${minimum}`);
  return payload[key];
}

function normalizeOperation(payload) {
  const status = requiredString(payload, 'status', 20).toLowerCase();
  if (!['pending', 'succeeded', 'failed', 'timed_out'].includes(status)) {
    throw new HttpError(
      400,
      'status must be pending, succeeded, failed, or timed_out',
    );
  }
  const desiredReplicas = optionalInteger(payload, 'desired_replicas');
  if (desiredReplicas === null)
    throw new HttpError(400, 'desired_replicas is required');

  return {
    request_id:
      typeof payload.request_id === 'string' &&
      /^[0-9a-f-]{36}$/i.test(payload.request_id)
        ? payload.request_id
        : randomUUID(),
    cluster_name: requiredString(payload, 'cluster_name'),
    namespace: requiredString(payload, 'namespace'),
    workload_kind: requiredString(payload, 'workload_kind', 80),
    workload_name: requiredString(payload, 'workload_name'),
    source:
      typeof payload.source === 'string' && payload.source.trim()
        ? payload.source.trim().slice(0, 80)
        : 'controller',
    previous_replicas: optionalInteger(payload, 'previous_replicas'),
    desired_replicas: desiredReplicas,
    actual_replicas: optionalInteger(payload, 'actual_replicas'),
    status,
    requested_by:
      typeof payload.requested_by === 'string'
        ? payload.requested_by.trim().slice(0, 200)
        : null,
    error_message:
      typeof payload.error_message === 'string'
        ? payload.error_message.trim().slice(0, 2000)
        : null,
    started_at: payload.started_at ? new Date(payload.started_at) : new Date(),
    finished_at: payload.finished_at ? new Date(payload.finished_at) : null,
    duration_ms: optionalInteger(payload, 'duration_ms'),
    retention_days: Math.min(
      3650,
      optionalInteger(payload, 'retention_days', 1) ?? historyDefaultDays,
    ),
    metadata:
      payload.metadata &&
      typeof payload.metadata === 'object' &&
      !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  };
}

async function ensureSchema() {
  await pool.query(
    'ALTER TABLE operations ADD COLUMN IF NOT EXISTS actual_replicas INTEGER',
  );
  await pool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'unchanged'",
  );
  await pool.query(
    'ALTER TABLE operations ADD COLUMN IF NOT EXISTS critical BOOLEAN NOT NULL DEFAULT FALSE',
  );
  await pool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS critical_reasons TEXT[] NOT NULL DEFAULT '{}'::text[]",
  );
  await pool.query(
    "ALTER TABLE operations ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'not_required'",
  );
  await pool.query(
    'ALTER TABLE operations ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS operations_critical_started_idx ON operations (critical, started_at DESC)',
  );
  await ensureDefinitionsSchema(pool);
  await ensureAwsRoleConfigSchema(pool);
}

async function storeOperation(operation, classification) {
  const result = await pool.query(
    `INSERT INTO operations (
       request_id, cluster_name, namespace, workload_kind, workload_name, source,
       previous_replicas, desired_replicas, actual_replicas, direction, status,
       requested_by, error_message, started_at, finished_at, duration_ms,
       retention_days, critical, critical_reasons, notification_status, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21
     )
     ON CONFLICT (request_id) DO UPDATE SET
       actual_replicas = EXCLUDED.actual_replicas,
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       finished_at = EXCLUDED.finished_at,
       duration_ms = EXCLUDED.duration_ms,
       critical = EXCLUDED.critical,
       critical_reasons = EXCLUDED.critical_reasons,
       notification_status = CASE
         WHEN operations.notification_status = 'sent' THEN operations.notification_status
         ELSE EXCLUDED.notification_status
       END,
       metadata = EXCLUDED.metadata
     RETURNING id, notification_status`,
    [
      operation.request_id,
      operation.cluster_name,
      operation.namespace,
      operation.workload_kind,
      operation.workload_name,
      operation.source,
      operation.previous_replicas,
      operation.desired_replicas,
      operation.actual_replicas,
      classification.direction,
      operation.status,
      operation.requested_by,
      operation.error_message,
      operation.started_at,
      operation.finished_at,
      operation.duration_ms,
      operation.retention_days,
      classification.critical,
      classification.reasons,
      classification.critical ? 'pending' : 'not_required',
      operation.metadata,
    ],
  );
  const operationId = result.rows[0].id;
  await pool.query(
    `INSERT INTO operation_events (operation_id, event_type, message, metadata)
     VALUES ($1, $2, $3, $4)`,
    [
      operationId,
      classification.critical ? 'critical_detected' : 'operation_reported',
      operation.error_message,
      { reasons: classification.reasons },
    ],
  );
  return {
    id: operationId,
    notificationStatus: result.rows[0].notification_status,
  };
}

async function recentlyNotified(operation, classification, operationId) {
  const result = await pool.query(
    `SELECT 1 FROM operations
     WHERE id <> $1 AND cluster_name = $2 AND namespace = $3 AND workload_name = $4
       AND notification_status = 'sent'
       AND critical_reasons && $5::text[]
       AND notification_sent_at > NOW() - ($6 * INTERVAL '1 second')
     LIMIT 1`,
    [
      operationId,
      operation.cluster_name,
      operation.namespace,
      operation.workload_name,
      classification.reasons,
      notificationCooldownSeconds,
    ],
  );
  return result.rowCount > 0;
}

function slackPayload(operation, classification) {
  const title = criticalTitle(operation, classification);
  return {
    text: `Scaler critical: ${title} for ${operation.namespace}/${operation.workload_name}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 Scaler critical: ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Workload*\n${operation.namespace}/${operation.workload_name}`,
          },
          { type: 'mrkdwn', text: `*Cluster*\n${operation.cluster_name}` },
          {
            type: 'mrkdwn',
            text: `*Replicas*\n${operation.previous_replicas ?? '?'} → ${operation.desired_replicas}${operation.actual_replicas === null ? '' : ` (actual ${operation.actual_replicas})`}`,
          },
          {
            type: 'mrkdwn',
            text: `*Duration*\n${operation.duration_ms === null ? 'unknown' : `${(operation.duration_ms / 1000).toFixed(2)}s`} (limit ${durationThresholdSeconds}s)`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reasons:* ${classification.reasons.join(', ')}${operation.error_message ? `\n*Error:* ${operation.error_message}` : ''}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Request ${operation.request_id} · source ${operation.source}`,
          },
        ],
      },
    ],
  };
}

async function notifySlack(operation, classification, operationId) {
  if (!classification.critical) return 'not_required';
  if (!slackWebhookUrl) {
    log('warn', 'SLACK_NOTIFICATION_DISABLED', {
      critical: true,
      request_id: operation.request_id,
      reasons: classification.reasons,
    });
    await updateNotification(operationId, 'disabled');
    return 'disabled';
  }
  if (await recentlyNotified(operation, classification, operationId)) {
    log('warn', 'SLACK_NOTIFICATION_SUPPRESSED', {
      critical: true,
      request_id: operation.request_id,
      reasons: classification.reasons,
      cooldown_seconds: notificationCooldownSeconds,
    });
    await updateNotification(operationId, 'suppressed');
    return 'suppressed';
  }

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(slackPayload(operation, classification)),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Slack returned HTTP ${response.status}`);
    await updateNotification(operationId, 'sent', true);
    log('info', 'SLACK_NOTIFICATION_SENT', {
      request_id: operation.request_id,
      workload: operation.workload_name,
      reasons: classification.reasons,
    });
    return 'sent';
  } catch (error) {
    await updateNotification(operationId, 'failed');
    log('error', 'SLACK_NOTIFICATION_FAILED', {
      critical: true,
      request_id: operation.request_id,
      workload: operation.workload_name,
      reasons: classification.reasons,
      error: error.message,
    });
    return 'failed';
  }
}

async function updateNotification(operationId, status, sent = false) {
  await pool.query(
    `UPDATE operations SET notification_status = $2, notification_sent_at = CASE WHEN $3 THEN NOW() ELSE notification_sent_at END WHERE id = $1`,
    [operationId, status, sent],
  );
  await pool.query(
    `INSERT INTO operation_events (operation_id, event_type, metadata) VALUES ($1, $2, $3)`,
    [operationId, `slack_${status}`, { channel: 'slack' }],
  );
}

async function handleReport(request, response) {
  const operation = normalizeOperation(await readJson(request));
  const classification = classifyOperation(operation, durationThresholdSeconds);
  const stored = await storeOperation(operation, classification);

  log(
    classification.critical ? 'error' : 'info',
    classification.critical
      ? 'CRITICAL_SCALE_OPERATION'
      : 'SCALE_OPERATION_RECORDED',
    {
      critical: classification.critical,
      request_id: operation.request_id,
      cluster: operation.cluster_name,
      namespace: operation.namespace,
      workload: operation.workload_name,
      direction: classification.direction,
      status: operation.status,
      previous_replicas: operation.previous_replicas,
      desired_replicas: operation.desired_replicas,
      actual_replicas: operation.actual_replicas,
      duration_ms: operation.duration_ms,
      threshold_ms: durationThresholdSeconds * 1000,
      reasons: classification.reasons,
      error: operation.error_message,
    },
  );

  const notificationStatus =
    classification.critical && stored.notificationStatus === 'sent'
      ? 'sent'
      : await notifySlack(operation, classification, stored.id);
  send(response, 202, {
    id: stored.id,
    request_id: operation.request_id,
    ...classification,
    notification_status: notificationStatus,
  });
}

async function handleList(request, response) {
  const url = new URL(
    request.url,
    `http://${request.headers.host ?? 'localhost'}`,
  );
  const limit = Math.min(
    200,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50,
    ),
  );
  const criticalOnly = url.searchParams.get('critical') === 'true';
  const result = await pool.query(
    `SELECT id, request_id, cluster_name, namespace, workload_kind, workload_name,
            source, previous_replicas, desired_replicas, actual_replicas, direction,
            status, error_message, started_at, finished_at, duration_ms, critical,
            critical_reasons, notification_status, notification_sent_at
       FROM operations
      WHERE ($1::boolean = FALSE OR critical = TRUE)
      ORDER BY started_at DESC LIMIT $2`,
    [criticalOnly, limit],
  );
  send(response, 200, { operations: result.rows });
}

async function handleSlackTest(response) {
  if (!slackWebhookUrl)
    throw new HttpError(503, 'SLACK_WEBHOOK_URL is not configured');
  const slackResponse = await fetch(slackWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `✅ Scaler Slack test succeeded. Critical duration threshold: ${durationThresholdSeconds}s.`,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!slackResponse.ok)
    throw new HttpError(502, `Slack returned HTTP ${slackResponse.status}`);
  log('info', 'SLACK_TEST_SENT');
  send(response, 200, { delivered: true });
}

function handleTriggerCatalog(response) {
  send(response, 200, { triggers: TRIGGER_CATALOG });
}

// Drives the Connections panel's "Create a trigger-reader role" flow: tells
// the operator exactly which AWS reads their *currently configured*
// triggers need, and the CloudFormation parameters that grant only that.
async function handleTriggerUsage(request, response) {
  const url = new URL(
    request.url,
    `http://${request.headers.host ?? 'localhost'}`,
  );
  const namespace = url.searchParams.get('namespace')?.trim() || 'scaler';
  const serviceAccount =
    url.searchParams.get('serviceAccount')?.trim() || 'scaler';
  const definitions = await listDefinitions(pool, { enabledOnly: true });
  const usage = summarizeTriggerUsage(definitions);
  const stackParameters = buildStackParameters(usage, {
    namespace,
    serviceAccount,
  });
  send(response, 200, {
    usage,
    stackParameters,
    template: 'deploy/cloudformation/trigger-role.yaml',
  });
}

async function handleGetAwsRole(response) {
  const config = await getAwsRoleConfig(pool);
  send(response, 200, { role: config });
}

async function handleSaveAwsRole(request, response) {
  const payload = await readJson(request);
  const roleArn =
    typeof payload.roleArn === 'string' ? payload.roleArn.trim() : '';
  if (!isValidRoleArn(roleArn)) {
    throw new HttpError(
      400,
      'roleArn must be a valid IAM role ARN (arn:aws:iam::<account>:role/<name>)',
    );
  }
  const saved = await saveAwsRoleArn(pool, roleArn);
  log('info', 'AWS_ROLE_SAVED', { role_arn: roleArn });
  send(response, 200, { role: saved });
}

// Verifies a candidate role ARN the operator is considering — before or
// after attaching it to the ServiceAccount — by checking whether the events
// API's own live AWS identity (its default credential chain: IRSA, node
// role, or static keys per AWS_CREDENTIAL_MODE) is already running as that
// role. Only persists the result when the tested ARN matches what's already
// saved; testing a not-yet-committed candidate never overwrites the saved
// config.
async function handleTestAwsRole(request, response) {
  const payload = await readJson(request);
  const roleArn =
    typeof payload.roleArn === 'string' ? payload.roleArn.trim() : '';
  if (!isValidRoleArn(roleArn)) {
    throw new HttpError(
      400,
      'roleArn must be a valid IAM role ARN (arn:aws:iam::<account>:role/<name>)',
    );
  }

  let callerArn = null;
  let error = null;
  try {
    const identity = await readCallerIdentity();
    callerArn = identity.arn;
  } catch (err) {
    error = err.message;
  }

  const matched = callerArn ? callerMatchesRole(callerArn, roleArn) : false;
  const message = error
    ? `Could not determine the server's AWS identity: ${error}`
    : matched
      ? 'Scaler is currently running as this role.'
      : `Scaler is currently running as a different identity (${callerArn ?? 'unknown'}). Attach this role's ARN to the ServiceAccount annotation and restart the pod, then test again.`;

  const saved = await getAwsRoleConfig(pool);
  let persisted = null;
  if (saved?.role_arn === roleArn) {
    persisted = await recordVerification(pool, roleArn, {
      verified: matched,
      identity: callerArn,
    });
  }

  log(matched ? 'info' : 'warn', 'AWS_ROLE_TESTED', {
    role_arn: roleArn,
    caller_arn: callerArn,
    matched,
    error,
  });
  send(response, 200, {
    testedRoleArn: roleArn,
    callerIdentityArn: callerArn,
    matched,
    message,
    saved: persisted,
  });
}

async function handleListDefinitions(response) {
  const definitions = await listDefinitions(pool);
  send(response, 200, { definitions });
}

async function handleCreateDefinition(request, response) {
  const payload = await readJson(request);
  let definition;
  try {
    definition = normalizeDefinition(payload);
  } catch (error) {
    if (error instanceof ValidationError)
      throw new HttpError(400, error.problems.join('; '));
    throw error;
  }
  const stored = await upsertDefinition(pool, definition);
  log('info', 'DEFINITION_SAVED', {
    namespace: stored.namespace,
    name: stored.name,
    source_type: stored.source_type,
  });
  send(response, 201, { definition: stored });
}

async function handleDeleteDefinition(response, params) {
  const deleted = await deleteDefinition(pool, params.namespace, params.name);
  if (!deleted) throw new HttpError(404, 'definition_not_found');
  send(response, 200, { deleted: true });
}

// Lets an EventBridge rule (e.g. on S3 "Object Created") or any other push
// source nudge a definition's demand without Scaler having to poll it.
async function handlePushWebhook(response, params) {
  const definitions = await listDefinitions(pool);
  const definition = definitions.find(
    (item) => item.namespace === params.namespace && item.name === params.name,
  );
  if (!definition) throw new HttpError(404, 'definition_not_found');
  if (TRIGGER_CATALOG[definition.source_type]?.mode !== 'push') {
    throw new HttpError(409, 'definition_is_not_a_push_trigger');
  }
  await recordPushEvent(pool, definition.id);
  log('info', 'PUSH_EVENT_RECORDED', {
    namespace: definition.namespace,
    name: definition.name,
    source_type: definition.source_type,
  });
  send(response, 202, { recorded: true });
}

/** Matches a simple `/:param` route pattern against a request pathname. */
function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':'))
      params[part.slice(1)] = decodeURIComponent(pathParts[index]);
    else if (part !== pathParts[index]) return null;
  }
  return params;
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS' && allowedOrigin) {
      response.writeHead(204, {
        ...responseHeaders(),
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      });
      response.end();
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      await pool.query('SELECT 1');
      send(response, 200, {
        status: 'ok',
        slack_configured: Boolean(slackWebhookUrl),
        critical_duration_seconds: durationThresholdSeconds,
      });
      return;
    }
    if (!authorized(request)) {
      send(response, 401, { error: 'unauthorized' });
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/operations')
      return await handleReport(request, response);
    if (request.method === 'GET' && request.url?.startsWith('/v1/operations'))
      return await handleList(request, response);
    if (
      request.method === 'POST' &&
      request.url === '/v1/notifications/slack/test'
    )
      return await handleSlackTest(response);

    const pathname = request.url?.split('?')[0] ?? '';
    if (request.method === 'GET' && pathname === '/v1/triggers')
      return handleTriggerCatalog(response);
    if (request.method === 'GET' && pathname === '/v1/definitions')
      return await handleListDefinitions(response);
    if (request.method === 'POST' && pathname === '/v1/definitions')
      return await handleCreateDefinition(request, response);
    const definitionParams = matchPath(
      '/v1/definitions/:namespace/:name',
      pathname,
    );
    if (definitionParams && request.method === 'DELETE')
      return await handleDeleteDefinition(response, definitionParams);
    const webhookParams = matchPath(
      '/v1/webhooks/push/:namespace/:name',
      pathname,
    );
    if (webhookParams && request.method === 'POST')
      return await handlePushWebhook(response, webhookParams);
    if (request.method === 'GET' && pathname === '/v1/aws/trigger-usage')
      return await handleTriggerUsage(request, response);
    if (request.method === 'GET' && pathname === '/v1/aws/role')
      return await handleGetAwsRole(response);
    if (request.method === 'PUT' && pathname === '/v1/aws/role')
      return await handleSaveAwsRole(request, response);
    if (request.method === 'POST' && pathname === '/v1/aws/role/test')
      return await handleTestAwsRole(request, response);

    send(response, 404, { error: 'not_found' });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    log(status >= 500 ? 'error' : 'warn', 'EVENT_API_REQUEST_FAILED', {
      status,
      method: request.method,
      path: request.url,
      error: error.message,
    });
    send(response, status, {
      error: status === 500 ? 'internal_server_error' : error.message,
    });
  }
});

await ensureSchema();
server.listen(port, '0.0.0.0', () => {
  log('info', 'EVENT_API_STARTED', {
    port,
    critical_duration_seconds: durationThresholdSeconds,
    slack_configured: Boolean(slackWebhookUrl),
    notification_cooldown_seconds: notificationCooldownSeconds,
  });
});

async function shutdown(signal) {
  log('info', 'EVENT_API_STOPPING', { signal });
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
