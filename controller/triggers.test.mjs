import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TRIGGER_TYPES,
  isKnownTriggerType,
  validateSource,
} from './triggers.mjs';

test('isKnownTriggerType recognizes every catalog entry', () => {
  for (const type of Object.values(TRIGGER_TYPES)) {
    assert.equal(isKnownTriggerType(type), true);
  }
  assert.equal(isKnownTriggerType('aws-kinesis'), false);
});

test('validateSource rejects a missing or unknown type', () => {
  assert.deepEqual(validateSource(undefined), ['source is required']);
  assert.match(
    validateSource({ type: 'bogus' })[0],
    /source\.type must be one of/,
  );
});

test('validateSource requires every field for AWS SQS', () => {
  const problems = validateSource({ type: TRIGGER_TYPES.AWS_SQS, config: {} });
  assert.deepEqual(problems, [
    'source.config.queueUrl is required for aws-sqs',
    'source.config.targetMessagesPerReplica is required for aws-sqs',
  ]);
});

test('validateSource accepts a complete AWS SQS source', () => {
  assert.deepEqual(
    validateSource({
      type: TRIGGER_TYPES.AWS_SQS,
      config: {
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
        targetMessagesPerReplica: 50,
      },
    }),
    [],
  );
});

test('validateSource rejects an out-of-range field value', () => {
  const problems = validateSource({
    type: TRIGGER_TYPES.AWS_SQS,
    config: { queueUrl: 'https://example.com/q', targetMessagesPerReplica: -5 },
  });
  assert.deepEqual(problems, [
    'source.config.targetMessagesPerReplica is invalid for aws-sqs',
  ]);
});

test('validateSource accepts the manual trigger with no config', () => {
  assert.deepEqual(
    validateSource({ type: TRIGGER_TYPES.MANUAL, config: {} }),
    [],
  );
});

test('validateSource covers the CloudWatch metric, alarm, schedule, and S3 triggers', () => {
  assert.deepEqual(
    validateSource({
      type: TRIGGER_TYPES.AWS_CLOUDWATCH_METRIC,
      config: {
        namespace: 'AWS/S3',
        metricName: 'NumberOfObjects',
        statistic: 'Average',
        targetValuePerReplica: 10_000,
      },
    }),
    [],
  );
  assert.deepEqual(
    validateSource({
      type: TRIGGER_TYPES.AWS_CLOUDWATCH_ALARM,
      config: { alarmName: 'queue-backlog-high', alarmReplicas: 20 },
    }),
    [],
  );
  // scheduledReplicas: 0 is valid — e.g. an overnight cooldown to zero.
  assert.deepEqual(
    validateSource({
      type: TRIGGER_TYPES.AWS_EVENTBRIDGE_SCHEDULE,
      config: {
        scheduleExpression: 'cron(30 23 * * ? *)',
        scheduledReplicas: 0,
      },
    }),
    [],
  );
  assert.deepEqual(
    validateSource({
      type: TRIGGER_TYPES.AWS_S3_EVENT,
      config: { bucketName: 'uploads', replicasPerEvent: 2, decaySeconds: 120 },
    }),
    [],
  );
});
