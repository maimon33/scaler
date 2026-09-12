// Catalog of trigger ("source") types a Scaler definition may use to compute
// replica demand. This is the backend half of the catalog — it defines which
// fields each trigger requires and how to validate them. The frontend mock
// (lib/triggers.ts) presents the same ids with copy and icons for the UI;
// keep the `id` values in both files in sync.
//
// Adding a trigger here does not by itself make it pollable — see
// controller/sources/ for the readers that turn a trigger's config into a
// single numeric "source value", and controller/reconciler.mjs for how that
// dispatch happens.

export const TRIGGER_TYPES = Object.freeze({
  MANUAL: 'manual',
  AWS_SQS: 'aws-sqs',
  AWS_CLOUDWATCH_METRIC: 'aws-cloudwatch-metric',
  AWS_CLOUDWATCH_ALARM: 'aws-cloudwatch-alarm',
  AWS_EVENTBRIDGE_SCHEDULE: 'aws-eventbridge-schedule',
  AWS_S3_EVENT: 'aws-s3-event',
});

const STRING_FIELD = (key, { maxLength = 300 } = {}) => ({
  key,
  required: true,
  validate: (value) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength,
});

const POSITIVE_NUMBER_FIELD = (key) => ({
  key,
  required: true,
  validate: (value) => Number.isFinite(value) && value > 0,
});

// For replica-count targets, unlike rates, 0 is a valid value (e.g. an
// alarm or schedule that scales a workload down to zero).
const NON_NEGATIVE_NUMBER_FIELD = (key) => ({
  key,
  required: true,
  validate: (value) => Number.isFinite(value) && value >= 0,
});

// Each entry describes: which config fields a source of this type requires,
// and whether it is polled on an interval, evaluated against an alarm state,
// or driven by push events Scaler receives (see /v1/webhooks in server.mjs).
export const TRIGGER_CATALOG = {
  [TRIGGER_TYPES.MANUAL]: {
    mode: 'manual',
    fields: [],
    description:
      'No automated source. Replicas only change from manual actions or schedules.',
  },
  [TRIGGER_TYPES.AWS_SQS]: {
    mode: 'poll',
    fields: [
      STRING_FIELD('queueUrl'),
      POSITIVE_NUMBER_FIELD('targetMessagesPerReplica'),
    ],
    description:
      'Scale on ApproximateNumberOfMessages(+NotVisible) in an SQS queue.',
  },
  [TRIGGER_TYPES.AWS_CLOUDWATCH_METRIC]: {
    mode: 'poll',
    fields: [
      STRING_FIELD('namespace'),
      STRING_FIELD('metricName'),
      STRING_FIELD('statistic', { maxLength: 20 }),
      POSITIVE_NUMBER_FIELD('targetValuePerReplica'),
    ],
    description:
      'Scale on any CloudWatch metric value per replica — covers S3 bucket size/object count, DynamoDB consumed capacity, ALB request count, Lambda concurrency, or MSK/Kafka consumer lag published as a metric.',
  },
  [TRIGGER_TYPES.AWS_CLOUDWATCH_ALARM]: {
    mode: 'alarm',
    fields: [
      STRING_FIELD('alarmName'),
      NON_NEGATIVE_NUMBER_FIELD('alarmReplicas'),
    ],
    description:
      'Scale to a fixed replica count while a CloudWatch Alarm is in ALARM state; return to baseline once it clears.',
  },
  [TRIGGER_TYPES.AWS_EVENTBRIDGE_SCHEDULE]: {
    mode: 'schedule',
    fields: [
      STRING_FIELD('scheduleExpression', { maxLength: 120 }),
      NON_NEGATIVE_NUMBER_FIELD('scheduledReplicas'),
    ],
    description:
      'Scale to a fixed replica count on an EventBridge cron/rate schedule. Complements the Schedules tab with a GitOps-friendly contract.',
  },
  [TRIGGER_TYPES.AWS_S3_EVENT]: {
    mode: 'push',
    fields: [
      STRING_FIELD('bucketName'),
      POSITIVE_NUMBER_FIELD('replicasPerEvent'),
      POSITIVE_NUMBER_FIELD('decaySeconds'),
    ],
    description:
      'Scale up in bursts as an EventBridge rule on S3 "Object Created" notifications posts to the /v1/webhooks/s3 endpoint; demand decays back down after decaySeconds of silence.',
  },
};

export function isKnownTriggerType(type) {
  return Object.prototype.hasOwnProperty.call(TRIGGER_CATALOG, type);
}

/**
 * Validate a `{ type, config }` source payload against its trigger's field
 * list. Returns a list of human-readable problems; an empty list means the
 * source is valid.
 */
export function validateSource(source) {
  if (!source || typeof source !== 'object') return ['source is required'];
  if (!isKnownTriggerType(source.type)) {
    return [
      `source.type must be one of: ${Object.keys(TRIGGER_CATALOG).join(', ')}`,
    ];
  }
  const config =
    source.config && typeof source.config === 'object' ? source.config : {};
  const problems = [];
  for (const field of TRIGGER_CATALOG[source.type].fields) {
    const value = config[field.key];
    if (field.required && (value === undefined || value === null)) {
      problems.push(
        `source.config.${field.key} is required for ${source.type}`,
      );
      continue;
    }
    if (value !== undefined && value !== null && !field.validate(value)) {
      problems.push(`source.config.${field.key} is invalid for ${source.type}`);
    }
  }
  return problems;
}
