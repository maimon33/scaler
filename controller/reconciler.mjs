// The real control loop the README describes as "next controller steps":
// for every enabled Scaler definition, check ownership, read its source,
// resolve a bounded desired replica count, and write it through the
// Kubernetes /scale subresource — then report the outcome to the events API
// so it shows up in the same operations history and Slack alerting the mock
// UI visualizes. Deliberately a single-replica polling loop for now; leader
// election and jitter are listed in the README as a later step.
import process from 'node:process';
import pg from 'pg';
import { listDefinitions, readPushEventCount } from './definitions.mjs';
import {
  applyHeadroom,
  clampReplicas,
  resolveDesiredReplicas,
} from './demand.mjs';
import { integerEnv } from './env.mjs';
import {
  createKubeClient,
  findOwningHpa,
  getScale,
  patchScale,
} from './k8s.mjs';
import { createLogger } from './log.mjs';
import { planReconciliation } from './plan.mjs';
import { readAlarmIsFiring, readMetricValue } from './sources/cloudwatch.mjs';
import { readQueueDepth } from './sources/sqs.mjs';
import { TRIGGER_TYPES } from './triggers.mjs';

const { Pool } = pg;
const log = createLogger();

const clusterName = process.env.CLUSTER_NAME ?? 'unknown-cluster';
const reconcileIntervalSeconds = integerEnv('RECONCILE_INTERVAL_SECONDS', 15);
const operationTimeoutSeconds = integerEnv('OPERATION_TIMEOUT_SECONDS', 10);
const eventsApiUrl = process.env.EVENTS_API_URL ?? 'http://127.0.0.1:3001';
const eventsApiToken = process.env.SCALER_EVENTS_TOKEN ?? '';

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: integerEnv('DATABASE_PORT', 5432),
  database: process.env.DATABASE_NAME ?? 'scaler',
  user: process.env.DATABASE_USER ?? 'scaler',
  password: process.env.DATABASE_PASSWORD,
  max: integerEnv('DATABASE_POOL_SIZE', 3),
});
pool.on('error', (error) =>
  log('error', 'DATABASE_POOL_ERROR', { error: error.message }),
);

const kubeClient = createKubeClient();

/**
 * Resolves one definition's current demand into the shape `planReconciliation`
 * expects. Source-read failures are caught here, never thrown, so one bad
 * trigger can't take down the whole reconcile pass.
 */
async function resolveDemand(definition) {
  const {
    source_type: type,
    source_config: config,
    headroom,
    min_replicas,
    max_replicas,
  } = definition;
  try {
    if (type === TRIGGER_TYPES.AWS_SQS) {
      const value = await readQueueDepth({ queueUrl: config.queueUrl });
      return {
        status: 'resolved',
        desiredReplicas: resolveDesiredReplicas({
          sourceValue: value,
          targetPerReplica: config.targetMessagesPerReplica,
          headroom,
          min: min_replicas,
          max: max_replicas,
        }),
      };
    }
    if (type === TRIGGER_TYPES.AWS_CLOUDWATCH_METRIC) {
      const value = await readMetricValue({
        namespace: config.namespace,
        metricName: config.metricName,
        statistic: config.statistic,
        dimensions: config.dimensions ?? {},
      });
      return {
        status: 'resolved',
        desiredReplicas: resolveDesiredReplicas({
          sourceValue: value,
          targetPerReplica: config.targetValuePerReplica,
          headroom,
          min: min_replicas,
          max: max_replicas,
        }),
      };
    }
    if (type === TRIGGER_TYPES.AWS_CLOUDWATCH_ALARM) {
      const firing = await readAlarmIsFiring({ alarmName: config.alarmName });
      const base = firing ? config.alarmReplicas : min_replicas;
      return {
        status: 'resolved',
        desiredReplicas: clampReplicas(
          applyHeadroom(base, headroom),
          min_replicas,
          max_replicas,
        ),
      };
    }
    if (type === TRIGGER_TYPES.AWS_S3_EVENT) {
      const count = await readPushEventCount(
        pool,
        definition.id,
        config.decaySeconds,
      );
      const base = min_replicas + count * config.replicasPerEvent;
      return {
        status: 'resolved',
        desiredReplicas: clampReplicas(
          applyHeadroom(base, headroom),
          min_replicas,
          max_replicas,
        ),
      };
    }
    // Manual sources never drive automated demand. Schedule-type triggers
    // declare the scaler.io contract but are evaluated by the dedicated
    // Schedules feature, not this poll loop, so a cron parser doesn't have
    // to live in two places.
    return {
      status: 'unsupported',
      reason:
        type === TRIGGER_TYPES.MANUAL
          ? 'manual_source'
          : 'schedule_owned_by_scheduler',
    };
  } catch (error) {
    log('warn', 'SOURCE_READ_FAILED', {
      namespace: definition.namespace,
      name: definition.name,
      source_type: type,
      error: error.message,
    });
    return { status: 'source_error' };
  }
}

async function reportOperation(payload) {
  if (!eventsApiToken) return;
  try {
    await fetch(`${eventsApiUrl}/v1/operations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${eventsApiToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    log('error', 'EVENTS_API_REPORT_FAILED', {
      error: error.message,
      workload: payload.workload_name,
    });
  }
}

async function reconcileDefinition(definition) {
  const target = {
    namespace: definition.namespace,
    kind: definition.target_kind,
    name: definition.target_name,
  };

  let owningHpa = null;
  let currentReplicas;
  try {
    [owningHpa, currentReplicas] = await Promise.all([
      findOwningHpa(kubeClient, target),
      getScale(kubeClient, target).then(
        (scale) => scale.status?.replicas ?? scale.spec?.replicas ?? 0,
      ),
    ]);
  } catch (error) {
    log('error', 'WORKLOAD_LOOKUP_FAILED', {
      namespace: definition.namespace,
      name: definition.target_name,
      error: error.message,
    });
    return;
  }

  const demand = await resolveDemand(definition);
  const plan = planReconciliation({
    definition,
    currentReplicas,
    owningHpa,
    demand,
  });

  log(plan.action === 'scale' ? 'info' : 'debug', 'RECONCILE_DECISION', {
    namespace: definition.namespace,
    name: definition.name,
    workload: definition.target_name,
    action: plan.action,
    reason: plan.reason,
    current_replicas: currentReplicas,
    desired_replicas: plan.desiredReplicas,
  });

  if (plan.action !== 'scale') return;

  const startedAt = new Date();
  try {
    await patchScale(kubeClient, target, plan.desiredReplicas);
    const durationMs = Date.now() - startedAt.getTime();
    const timedOut = durationMs > operationTimeoutSeconds * 1000;
    await reportOperation({
      cluster_name: clusterName,
      namespace: definition.namespace,
      workload_kind: definition.target_kind,
      workload_name: definition.target_name,
      source: definition.source_type,
      previous_replicas: currentReplicas,
      desired_replicas: plan.desiredReplicas,
      actual_replicas: plan.desiredReplicas,
      status: timedOut ? 'timed_out' : 'succeeded',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
    });
  } catch (error) {
    await reportOperation({
      cluster_name: clusterName,
      namespace: definition.namespace,
      workload_kind: definition.target_kind,
      workload_name: definition.target_name,
      source: definition.source_type,
      previous_replicas: currentReplicas,
      desired_replicas: plan.desiredReplicas,
      status: 'failed',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      error_message: error.message,
    });
  }
}

export async function reconcileOnce() {
  const definitions = await listDefinitions(pool, { enabledOnly: true });
  await Promise.all(
    definitions.map((definition) => reconcileDefinition(definition)),
  );
}

async function mainLoop() {
  log('info', 'RECONCILER_STARTED', {
    cluster: clusterName,
    interval_seconds: reconcileIntervalSeconds,
  });
  for (;;) {
    try {
      await reconcileOnce();
    } catch (error) {
      log('error', 'RECONCILE_PASS_FAILED', { error: error.message });
    }
    await new Promise((resolve) =>
      setTimeout(resolve, reconcileIntervalSeconds * 1000),
    );
  }
}

async function shutdown(signal) {
  log('info', 'RECONCILER_STOPPING', { signal });
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Allow this module to be imported by tests without starting the loop.
if (process.env.NODE_ENV !== 'test') {
  void mainLoop();
}
