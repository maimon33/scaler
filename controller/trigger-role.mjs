// Pure helpers behind the Connections panel's "Trigger role" flow and the
// CloudFormation template at deploy/cloudformation/trigger-role.yaml: derive
// which AWS reads a set of Scaler definitions actually need, so the guided
// flow can tell the operator exactly what to grant — nothing more.
//
// What each trigger actually reads, per controller/sources/*.mjs:
//   aws-sqs                -> sqs:GetQueueAttributes on the queue's own ARN
//   aws-cloudwatch-metric  -> cloudwatch:GetMetricData
//   aws-cloudwatch-alarm   -> cloudwatch:DescribeAlarms
//   manual / aws-eventbridge-schedule / aws-s3-event
//                           -> no AWS read calls (schedule triggers are
//                              evaluated by the Schedules feature, not
//                              polled here; the S3 trigger is push-based —
//                              Scaler receives a webhook, it never calls S3
//                              or EventBridge APIs itself).

const ROLE_ARN_PATTERN = /^arn:aws:iam::\d{12}:role\/[\w+=,./@-]{1,64}$/;

export function isValidRoleArn(roleArn) {
  return typeof roleArn === 'string' && ROLE_ARN_PATTERN.test(roleArn);
}

/**
 * SQS queue URLs are `https://sqs.<region>.amazonaws.com/<accountId>/<name>`,
 * which already contains everything needed to build the queue's ARN without
 * an extra AWS call.
 */
export function queueUrlToArn(queueUrl) {
  const match =
    /^https:\/\/sqs\.([a-z0-9-]+)\.amazonaws\.com\/(\d{12})\/([^/?]+)/.exec(
      queueUrl ?? '',
    );
  if (!match) return null;
  const [, region, accountId, queueName] = match;
  return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
}

/**
 * Reduces a list of Scaler definitions (the shape returned by
 * `GET /v1/definitions`) to exactly what the trigger-role flow needs to
 * know: which SQS queues are actually read, and whether any CloudWatch
 * trigger is configured at all. Disabled definitions are excluded — a
 * paused trigger doesn't need read access.
 */
export function summarizeTriggerUsage(definitions) {
  const queueArns = new Set();
  const unresolvedQueueUrls = [];
  let usesCloudWatch = false;

  for (const definition of definitions ?? []) {
    if (definition.enabled === false) continue;
    if (definition.source_type === 'aws-sqs') {
      const queueUrl = definition.source_config?.queueUrl;
      const arn = queueUrlToArn(queueUrl);
      if (arn) queueArns.add(arn);
      else if (queueUrl) unresolvedQueueUrls.push(queueUrl);
    } else if (
      definition.source_type === 'aws-cloudwatch-metric' ||
      definition.source_type === 'aws-cloudwatch-alarm'
    ) {
      usesCloudWatch = true;
    }
  }

  return {
    queueArns: [...queueArns],
    usesCloudWatch,
    unresolvedQueueUrls,
  };
}

/**
 * The CloudFormation parameter overrides for deploy/cloudformation/trigger-role.yaml
 * that match a given trigger-usage summary — what the Connections panel
 * shows as the ready-to-run `aws cloudformation deploy` command.
 */
export function buildStackParameters(
  usage,
  { namespace = 'scaler', serviceAccount = 'scaler' } = {},
) {
  return {
    Namespace: namespace,
    ServiceAccountName: serviceAccount,
    QueueArns: usage.queueArns.length > 0 ? usage.queueArns.join(',') : '',
    EnableCloudWatchRead: usage.usesCloudWatch ? 'true' : 'false',
  };
}

/**
 * STS GetCallerIdentity returns an "assumed-role" session ARN
 * (arn:aws:sts::<account>:assumed-role/<role-name>/<session>) when running
 * under IRSA, not the IAM role ARN itself. This extracts the role name from
 * either form so a live caller identity can be compared against a plain
 * IAM role ARN the operator pasted in.
 */
export function extractRoleName(arn) {
  const iamMatch = /^arn:aws:iam::\d{12}:role\/(?:.*\/)?([^/]+)$/.exec(
    arn ?? '',
  );
  if (iamMatch) return iamMatch[1];
  const stsMatch = /^arn:aws:sts::\d{12}:assumed-role\/([^/]+)\//.exec(
    arn ?? '',
  );
  if (stsMatch) return stsMatch[1];
  return null;
}

/** True when a live STS caller identity is running as the given role ARN. */
export function callerMatchesRole(callerArn, targetRoleArn) {
  const callerRoleName = extractRoleName(callerArn);
  const targetRoleName = extractRoleName(targetRoleArn);
  return Boolean(callerRoleName) && callerRoleName === targetRoleName;
}
