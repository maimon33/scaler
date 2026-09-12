import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __setCloudWatchClientForTesting,
  readAlarmIsFiring,
  readMetricValue,
} from './cloudwatch.mjs';

test('readMetricValue returns the newest data point', async () => {
  __setCloudWatchClientForTesting({
    send: async () => ({
      MetricDataResults: [{ Values: [12_500, 11_800, 10_900] }],
    }),
  });
  assert.equal(
    await readMetricValue({
      namespace: 'AWS/S3',
      metricName: 'NumberOfObjects',
      statistic: 'Average',
    }),
    12_500,
  );
});

test('readMetricValue returns 0 when there are no data points yet', async () => {
  __setCloudWatchClientForTesting({
    send: async () => ({ MetricDataResults: [{ Values: [] }] }),
  });
  assert.equal(
    await readMetricValue({
      namespace: 'AWS/S3',
      metricName: 'NumberOfObjects',
      statistic: 'Average',
    }),
    0,
  );
});

test('readAlarmIsFiring is true only in ALARM state', async () => {
  __setCloudWatchClientForTesting({
    send: async () => ({ MetricAlarms: [{ StateValue: 'ALARM' }] }),
  });
  assert.equal(
    await readAlarmIsFiring({ alarmName: 'queue-backlog-high' }),
    true,
  );

  __setCloudWatchClientForTesting({
    send: async () => ({ MetricAlarms: [{ StateValue: 'OK' }] }),
  });
  assert.equal(
    await readAlarmIsFiring({ alarmName: 'queue-backlog-high' }),
    false,
  );
});

test('readAlarmIsFiring is false when the alarm is not found', async () => {
  __setCloudWatchClientForTesting({ send: async () => ({}) });
  assert.equal(await readAlarmIsFiring({ alarmName: 'missing' }), false);
});
