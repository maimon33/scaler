// Reads the two CloudWatch-backed triggers: an arbitrary metric value (used
// for S3, DynamoDB, ALB, Lambda, MSK/Kafka lag, or any custom metric — AWS
// exposes all of these through CloudWatch, so one reader covers the catalog)
// and a named alarm's current state.
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

let cachedClient;
function client() {
  if (!cachedClient) cachedClient = new CloudWatchClient({});
  return cachedClient;
}

/** For tests: replace or reset the singleton CloudWatch client. */
export function __setCloudWatchClientForTesting(mock) {
  cachedClient = mock;
}

/** Reads the most recent data point for a metric over the last 5 minutes. */
export async function readMetricValue({
  namespace,
  metricName,
  statistic,
  dimensions = {},
}) {
  const now = new Date();
  const response = await client().send(
    new GetMetricDataCommand({
      StartTime: new Date(now.getTime() - 5 * 60_000),
      EndTime: now,
      MetricDataQueries: [
        {
          Id: 'demand',
          MetricStat: {
            Metric: {
              Namespace: namespace,
              MetricName: metricName,
              Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({
                Name,
                Value,
              })),
            },
            Period: 60,
            Stat: statistic,
          },
        },
      ],
    }),
  );
  const values = response.MetricDataResults?.[0]?.Values ?? [];
  // GetMetricData returns points newest-first.
  return values.length > 0 ? values[0] : 0;
}

/** Returns true while the named alarm is in ALARM state. */
export async function readAlarmIsFiring({ alarmName }) {
  const response = await client().send(
    new DescribeAlarmsCommand({ AlarmNames: [alarmName] }),
  );
  const alarm = response.MetricAlarms?.[0] ?? response.CompositeAlarms?.[0];
  return alarm?.StateValue === 'ALARM';
}
