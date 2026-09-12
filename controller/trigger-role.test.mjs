import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStackParameters,
  callerMatchesRole,
  extractRoleName,
  isValidRoleArn,
  queueUrlToArn,
  summarizeTriggerUsage,
} from './trigger-role.mjs';

test('isValidRoleArn accepts a well-formed role ARN', () => {
  assert.equal(
    isValidRoleArn('arn:aws:iam::123456789012:role/scaler-trigger-reader'),
    true,
  );
  assert.equal(
    isValidRoleArn('arn:aws:iam::123456789012:role/team/scaler-trigger-reader'),
    true,
  );
});

test('isValidRoleArn rejects non-role ARNs and garbage', () => {
  assert.equal(
    isValidRoleArn('arn:aws:iam::123456789012:user/not-a-role'),
    false,
  );
  assert.equal(isValidRoleArn('not-an-arn'), false);
  assert.equal(isValidRoleArn(''), false);
  assert.equal(isValidRoleArn(undefined), false);
  assert.equal(isValidRoleArn('arn:aws:iam::12:role/too-short-account'), false);
});

test('queueUrlToArn derives the ARN from a standard SQS queue URL', () => {
  assert.equal(
    queueUrlToArn('https://sqs.us-east-1.amazonaws.com/123456789012/events'),
    'arn:aws:sqs:us-east-1:123456789012:events',
  );
});

test('queueUrlToArn returns null for an unrecognized URL shape', () => {
  assert.equal(queueUrlToArn('https://example.com/not-sqs'), null);
  assert.equal(queueUrlToArn(undefined), null);
});

test('summarizeTriggerUsage collects distinct queue ARNs and detects CloudWatch usage', () => {
  const usage = summarizeTriggerUsage([
    {
      enabled: true,
      source_type: 'aws-sqs',
      source_config: {
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
      },
    },
    // Same queue again, from a second definition — should not duplicate.
    {
      enabled: true,
      source_type: 'aws-sqs',
      source_config: {
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
      },
    },
    {
      enabled: true,
      source_type: 'aws-sqs',
      source_config: {
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/other',
      },
    },
    { enabled: true, source_type: 'aws-cloudwatch-alarm', source_config: {} },
    { enabled: true, source_type: 'manual', source_config: {} },
  ]);
  assert.deepEqual(
    usage.queueArns.sort((a, b) => a.localeCompare(b)),
    [
      'arn:aws:sqs:us-east-1:123456789012:events',
      'arn:aws:sqs:us-east-1:123456789012:other',
    ],
  );
  assert.equal(usage.usesCloudWatch, true);
  assert.deepEqual(usage.unresolvedQueueUrls, []);
});

test('summarizeTriggerUsage ignores disabled definitions', () => {
  const usage = summarizeTriggerUsage([
    {
      enabled: false,
      source_type: 'aws-sqs',
      source_config: {
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
      },
    },
    { enabled: false, source_type: 'aws-cloudwatch-metric', source_config: {} },
  ]);
  assert.deepEqual(usage.queueArns, []);
  assert.equal(usage.usesCloudWatch, false);
});

test('summarizeTriggerUsage reports queue URLs it could not turn into an ARN', () => {
  const usage = summarizeTriggerUsage([
    {
      enabled: true,
      source_type: 'aws-sqs',
      source_config: { queueUrl: 'not-a-real-url' },
    },
  ]);
  assert.deepEqual(usage.unresolvedQueueUrls, ['not-a-real-url']);
  assert.deepEqual(usage.queueArns, []);
});

test('summarizeTriggerUsage on no definitions needs no role at all', () => {
  const usage = summarizeTriggerUsage([]);
  assert.deepEqual(usage.queueArns, []);
  assert.equal(usage.usesCloudWatch, false);
});

test('buildStackParameters turns usage into CloudFormation parameter overrides', () => {
  const usage = {
    queueArns: [
      'arn:aws:sqs:us-east-1:123456789012:events',
      'arn:aws:sqs:us-east-1:123456789012:other',
    ],
    usesCloudWatch: true,
  };
  assert.deepEqual(
    buildStackParameters(usage, {
      namespace: 'production',
      serviceAccount: 'scaler',
    }),
    {
      Namespace: 'production',
      ServiceAccountName: 'scaler',
      QueueArns:
        'arn:aws:sqs:us-east-1:123456789012:events,arn:aws:sqs:us-east-1:123456789012:other',
      EnableCloudWatchRead: 'true',
    },
  );
});

test('buildStackParameters defaults to no queues and CloudWatch disabled', () => {
  assert.deepEqual(
    buildStackParameters({ queueArns: [], usesCloudWatch: false }),
    {
      Namespace: 'scaler',
      ServiceAccountName: 'scaler',
      QueueArns: '',
      EnableCloudWatchRead: 'false',
    },
  );
});

test('extractRoleName reads the role name out of a plain IAM role ARN', () => {
  assert.equal(
    extractRoleName('arn:aws:iam::123456789012:role/scaler-trigger-reader'),
    'scaler-trigger-reader',
  );
  assert.equal(
    extractRoleName(
      'arn:aws:iam::123456789012:role/team/scaler-trigger-reader',
    ),
    'scaler-trigger-reader',
  );
});

test('extractRoleName reads the role name out of an STS assumed-role session ARN', () => {
  assert.equal(
    extractRoleName(
      'arn:aws:sts::123456789012:assumed-role/scaler-trigger-reader/eks-abc123',
    ),
    'scaler-trigger-reader',
  );
});

test('extractRoleName returns null for anything else', () => {
  assert.equal(extractRoleName('arn:aws:iam::123456789012:user/someone'), null);
  assert.equal(extractRoleName(undefined), null);
  assert.equal(extractRoleName(''), null);
});

test('callerMatchesRole is true when the live identity is an assumed session of the target role', () => {
  assert.equal(
    callerMatchesRole(
      'arn:aws:sts::123456789012:assumed-role/scaler-trigger-reader/eks-abc123',
      'arn:aws:iam::123456789012:role/scaler-trigger-reader',
    ),
    true,
  );
});

test('callerMatchesRole is false for a different role or an unparseable ARN', () => {
  assert.equal(
    callerMatchesRole(
      'arn:aws:sts::123456789012:assumed-role/some-other-role/eks-abc123',
      'arn:aws:iam::123456789012:role/scaler-trigger-reader',
    ),
    false,
  );
  assert.equal(
    callerMatchesRole(
      undefined,
      'arn:aws:iam::123456789012:role/scaler-trigger-reader',
    ),
    false,
  );
});
