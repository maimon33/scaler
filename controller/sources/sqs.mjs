// Reads the AWS SQS trigger's demand signal: visible + in-flight messages,
// so a backlog doesn't look "resolved" just because a batch is currently
// being processed.
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';

let cachedClient;
function client() {
  if (!cachedClient) cachedClient = new SQSClient({});
  return cachedClient;
}

/** For tests: replace or reset the singleton SQS client. */
export function __setSqsClientForTesting(mock) {
  cachedClient = mock;
}

export async function readQueueDepth({ queueUrl }) {
  const response = await client().send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
      ],
    }),
  );
  const visible = Number.parseInt(
    response.Attributes?.ApproximateNumberOfMessages ?? '0',
    10,
  );
  const inFlight = Number.parseInt(
    response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? '0',
    10,
  );
  return (
    (Number.isFinite(visible) ? visible : 0) +
    (Number.isFinite(inFlight) ? inFlight : 0)
  );
}
