// Frontend half of the trigger catalog: presentation (icon, copy, form
// fields) for the same trigger types controller/triggers.mjs validates on
// the backend. Keep the `id` values and field `key`s in sync with that file
// — the "Guided" and "YAML" tabs in the definition dialog, and the demo
// Workloads table, are all driven from this list.
import {
  BarChart3,
  BellRing,
  CalendarClock,
  MousePointerClick,
  Radio,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import type {
  TriggerField,
  TriggerFieldValues,
  TriggerTypeId,
} from '@/lib/types';

export type TriggerDefinition = {
  id: TriggerTypeId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  mode: 'manual' | 'poll' | 'alarm' | 'schedule' | 'push';
  fields: TriggerField[];
  /** Lines shown on the "Calculate" node in the Flow / Composer tab. */
  flowLines: (values: TriggerFieldValues) => string[];
  /** The `source:` block's inner lines (unindented) for the YAML tab. */
  yamlLines: (values: TriggerFieldValues) => string[];
};

function field(overrides: TriggerField): TriggerField {
  return overrides;
}

export const TRIGGER_CATALOG: TriggerDefinition[] = [
  {
    id: 'manual',
    label: 'Manual only',
    shortLabel: 'Manual',
    icon: MousePointerClick,
    description:
      'No automated source. Replicas only change from manual actions or schedules.',
    mode: 'manual',
    fields: [],
    flowLines: () => ['No automated signal', 'Manual + schedules only'],
    yamlLines: () => ['type: manual'],
  },
  {
    id: 'aws-sqs',
    label: 'AWS SQS',
    shortLabel: 'SQS',
    icon: Radio,
    description: 'Scale on visible + in-flight messages in an SQS queue.',
    mode: 'poll',
    fields: [
      field({
        key: 'queueUrl',
        label: 'Queue URL',
        type: 'text',
        defaultValue: 'https://sqs.us-east-1.amazonaws.com/123456789012/events',
        wide: true,
      }),
      field({
        key: 'targetMessagesPerReplica',
        label: 'Messages / replica',
        type: 'number',
        defaultValue: 50,
      }),
    ],
    flowLines: (values) => [
      'Queue depth · every 5s',
      `${values.targetMessagesPerReplica} messages / replica`,
    ],
    yamlLines: (values) => [
      'type: aws-sqs',
      `queueURL: ${values.queueUrl}`,
      `targetMessagesPerReplica: ${values.targetMessagesPerReplica}`,
    ],
  },
  {
    id: 'aws-cloudwatch-metric',
    label: 'CloudWatch metric',
    shortLabel: 'CloudWatch',
    icon: BarChart3,
    description:
      'Scale on any CloudWatch metric per replica — covers S3 object count, DynamoDB capacity, ALB requests, Lambda concurrency, or MSK/Kafka lag.',
    mode: 'poll',
    fields: [
      field({
        key: 'namespace',
        label: 'Namespace',
        type: 'text',
        defaultValue: 'AWS/S3',
      }),
      field({
        key: 'metricName',
        label: 'Metric name',
        type: 'text',
        defaultValue: 'NumberOfObjects',
      }),
      field({
        key: 'statistic',
        label: 'Statistic',
        type: 'text',
        defaultValue: 'Average',
      }),
      field({
        key: 'targetValuePerReplica',
        label: 'Target value / replica',
        type: 'number',
        defaultValue: 10_000,
      }),
    ],
    flowLines: (values) => [
      `${values.namespace} · ${values.metricName}`,
      `${values.statistic}, ${values.targetValuePerReplica} / replica`,
    ],
    yamlLines: (values) => [
      'type: aws-cloudwatch-metric',
      `namespace: ${values.namespace}`,
      `metricName: ${values.metricName}`,
      `statistic: ${values.statistic}`,
      `targetValuePerReplica: ${values.targetValuePerReplica}`,
    ],
  },
  {
    id: 'aws-cloudwatch-alarm',
    label: 'CloudWatch alarm',
    shortLabel: 'CW Alarm',
    icon: BellRing,
    description:
      'Scale to a fixed replica count while a CloudWatch Alarm is firing; return to baseline once it clears.',
    mode: 'alarm',
    fields: [
      field({
        key: 'alarmName',
        label: 'Alarm name',
        type: 'text',
        defaultValue: 'queue-backlog-high',
        wide: true,
      }),
      field({
        key: 'alarmReplicas',
        label: 'Replicas while firing',
        type: 'number',
        defaultValue: 20,
      }),
    ],
    flowLines: (values) => [
      `Alarm: ${values.alarmName}`,
      `${values.alarmReplicas} replicas while firing`,
    ],
    yamlLines: (values) => [
      'type: aws-cloudwatch-alarm',
      `alarmName: ${values.alarmName}`,
      `alarmReplicas: ${values.alarmReplicas}`,
    ],
  },
  {
    id: 'aws-eventbridge-schedule',
    label: 'EventBridge schedule',
    shortLabel: 'Schedule',
    icon: CalendarClock,
    description:
      'Scale to a fixed replica count on an EventBridge cron/rate expression.',
    mode: 'schedule',
    fields: [
      field({
        key: 'scheduleExpression',
        label: 'Schedule expression',
        type: 'text',
        defaultValue: 'cron(30 23 * * ? *)',
        wide: true,
      }),
      field({
        key: 'scheduledReplicas',
        label: 'Replicas',
        type: 'number',
        defaultValue: 0,
      }),
    ],
    flowLines: (values) => [
      String(values.scheduleExpression),
      `${values.scheduledReplicas} replicas`,
    ],
    yamlLines: (values) => [
      'type: aws-eventbridge-schedule',
      `scheduleExpression: "${values.scheduleExpression}"`,
      `scheduledReplicas: ${values.scheduledReplicas}`,
    ],
  },
  {
    id: 'aws-s3-event',
    label: 'S3 object created (EventBridge)',
    shortLabel: 'S3 event',
    icon: UploadCloud,
    description:
      'Scale up in bursts as an EventBridge rule on S3 "Object Created" notifications posts to a Scaler webhook; demand decays back down after a quiet window.',
    mode: 'push',
    fields: [
      field({
        key: 'bucketName',
        label: 'Bucket name',
        type: 'text',
        defaultValue: 'uploads',
        wide: true,
      }),
      field({
        key: 'replicasPerEvent',
        label: 'Replicas / event',
        type: 'number',
        defaultValue: 2,
      }),
      field({
        key: 'decaySeconds',
        label: 'Decay after',
        type: 'number',
        defaultValue: 120,
        suffix: 'seconds',
      }),
    ],
    flowLines: (values) => [
      `s3://${values.bucketName} · Object Created`,
      `+${values.replicasPerEvent} replicas / event, decays after ${values.decaySeconds}s`,
    ],
    yamlLines: (values) => [
      'type: aws-s3-event',
      `bucketName: ${values.bucketName}`,
      `replicasPerEvent: ${values.replicasPerEvent}`,
      `decaySeconds: ${values.decaySeconds}`,
    ],
  },
];

export function getTrigger(id: TriggerTypeId): TriggerDefinition {
  return (
    TRIGGER_CATALOG.find((trigger) => trigger.id === id) ?? TRIGGER_CATALOG[0]
  );
}

export function defaultFieldValues(
  trigger: TriggerDefinition,
): TriggerFieldValues {
  return Object.fromEntries(trigger.fields.map((f) => [f.key, f.defaultValue]));
}
