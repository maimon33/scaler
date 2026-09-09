export type WorkloadKind = 'Deployment' | 'StatefulSet' | 'DaemonSet'
export type WorkloadStatus = 'Running' | 'Scaling' | 'Paused' | 'Recommended'
export type MetricType = 'cpu' | 'sqs' | 'requests' | 'schedule'
export type Maturity = 'Ready' | 'Next'

export interface Workload {
  id: string
  name: string
  kind: WorkloadKind
  namespace: string
  currentReplicas: number
  desiredReplicas: number
  minReplicas: number
  maxReplicas: number
  status: WorkloadStatus
  primaryMetric: MetricType
  metricValue: number
  metricUnit: string
  lastScaledAt: Date | null
  description: string
}

export interface ScalingAction {
  id: string
  workloadId: string
  timestamp: Date
  fromReplicas: number
  toReplicas: number
  trigger: string
}

export interface TargetRef {
  kind: WorkloadKind
  name: string
  namespace?: string
}

export interface ReplicaConfig {
  min: number
  max: number
  headroom?: {
    type: 'percent' | 'replicas'
    value: number
  }
}

export interface Signal {
  type: MetricType
  metric?: string
}

export interface ScalerDefinition {
  apiVersion: 'scaler.io/v1alpha1'
  kind: 'Scaler'
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    targetRef: TargetRef
    replicas: ReplicaConfig
    signal: Signal
  }
}

export interface Pattern {
  id: string
  name: string
  description: string
  useCase: string
  trigger: string
  maturity: Maturity
  tags: string[]
  template: ScalerDefinition
}

export interface Scenario {
  id: string
  name: string
  description: string
  metricGenerators: Record<string, () => number>
}

export interface ScalerStore {
  workloads: Workload[]
  scalingActions: ScalingAction[]
  currentScenario: string
  currentPattern: Pattern | null
  editingDefinition: ScalerDefinition | null
  selectedWorkloadId: string | null
}
