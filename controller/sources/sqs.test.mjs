import assert from 'node:assert/strict';
import test from 'node:test';
import { __setSqsClientForTesting, readQueueDepth } from './sqs.mjs';

test('readQueueDepth sums visible and in-flight messages', async () => {
  __setSqsClientForTesting({
    send: async () => ({
      Attributes: {
        ApproximateNumberOfMessages: '8000',
        ApproximateNumberOfMessagesNotVisible: '200',
      },
    }),
  });
  assert.equal(
    await readQueueDepth({ queueUrl: 'https://example.com/q' }),
    8200,
  );
});

test('readQueueDepth defaults missing attributes to zero', async () => {
  __setSqsClientForTesting({ send: async () => ({}) });
  assert.equal(await readQueueDepth({ queueUrl: 'https://example.com/q' }), 0);
});
