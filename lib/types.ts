// Shared types for the Scaler dashboard mock. Kept separate from app/page.tsx
// so demo data, the trigger catalog, and UI components can all reference
// them without importing the page component itself.

export type Service = {
  name: string;
  namespace: string;
  current: number;
  desired: number;
  min: number;
  max: number;
  trigger: string;
  triggerType: TriggerTypeId;
  owner: 'Scaler' | 'Native HPA' | 'Unmanaged';
  latency: string;
  state: 'Stable' | 'Scaling' | 'Paused';
};

export type Operation = {
  id: string;
  workload: string;
  namespace: string;
  kind: 'Scale' | 'Schedule' | 'Revert';
  from: number;
  to: number;
  status: 'Running' | 'Succeeded' | 'Timed out' | 'Scheduled';
  elapsedSeconds: number;
  timeoutSeconds: number;
  actor: string;
  retentionDays: number;
  editable: boolean;
  reversible: boolean;
  critical?: boolean;
  criticalReasons?: string[];
  notificationStatus?: 'Sent' | 'Suppressed' | 'Disabled' | 'None';
};

// Mirrors controller/triggers.mjs's TRIGGER_TYPES — keep the string values in
// sync with the backend catalog so a definition drafted in the UI maps
// directly onto the scaler.io/v1alpha1 contract the reconciler polls.
export type TriggerTypeId =
  | 'manual'
  | 'aws-sqs'
  | 'aws-cloudwatch-metric'
  | 'aws-cloudwatch-alarm'
  | 'aws-eventbridge-schedule'
  | 'aws-s3-event';

export type TriggerFieldType = 'text' | 'number';

export type TriggerField = {
  key: string;
  label: string;
  type: TriggerFieldType;
  defaultValue: string | number;
  placeholder?: string;
  suffix?: string;
  wide?: boolean;
};

export type TriggerFieldValues = Record<string, string | number>;
