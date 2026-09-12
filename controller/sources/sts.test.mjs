import assert from 'node:assert/strict';
import test from 'node:test';
import { __setStsClientForTesting, readCallerIdentity } from './sts.mjs';

test('readCallerIdentity returns the ARN, account, and user id', async () => {
  __setStsClientForTesting({
    send: async () => ({
      Arn: 'arn:aws:sts::123456789012:assumed-role/scaler-trigger-reader/eks-abc123',
      Account: '123456789012',
      UserId: 'AROAEXAMPLE:eks-abc123',
    }),
  });
  assert.deepEqual(await readCallerIdentity(), {
    arn: 'arn:aws:sts::123456789012:assumed-role/scaler-trigger-reader/eks-abc123',
    account: '123456789012',
    userId: 'AROAEXAMPLE:eks-abc123',
  });
});
