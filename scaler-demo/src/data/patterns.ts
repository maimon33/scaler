import type { Pattern } from '../types'

export const PATTERNS: Pattern[] = [
  {
    id: 'sqs-worker',
    name: 'SQS Queue Worker',
    description: 'Scale based on SQS queue depth. Recommended for asynchronous job processors.',
    useCase: 'Asynchronous Processing',
    trigger: 'AWS SQS',
    maturity: 'Ready',
    tags: ['sqs', 'queue', 'worker', 'async'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'worker-sqs', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'events-worker' },
        replicas: { min: 1, max: 100, headroom: { type: 'percent', value: 20 } },
        signal: { type: 'sqs', metric: 'ApproximateNumberOfMessagesVisible' }
      }
    }
  },
  {
    id: 'cpu-scale',
    name: 'CPU-Based Scaling',
    description: 'Simple CPU percentage-based scaling for request-handling workloads.',
    useCase: 'Request Handling',
    trigger: 'CPU',
    maturity: 'Ready',
    tags: ['cpu', 'metrics', 'request'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'api-cpu', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'checkout-api' },
        replicas: { min: 2, max: 50, headroom: { type: 'replicas', value: 2 } },
        signal: { type: 'cpu' }
      }
    }
  },
  {
    id: 'scheduled-batch',
    name: 'Scheduled Batch Window',
    description: 'Scale up during defined time windows, scale down outside of them.',
    useCase: 'Batch Processing',
    trigger: 'Schedule (Cron)',
    maturity: 'Ready',
    tags: ['schedule', 'batch', 'cron'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'pdf-renderer-schedule', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'pdf-renderer' },
        replicas: { min: 0, max: 10 },
        signal: { type: 'schedule', metric: '0 6 * * *' }
      }
    }
  },
  {
    id: 'request-rate',
    name: 'Request Rate Scaling',
    description: 'Scale based on incoming request rate (requests/second).',
    useCase: 'API Tier',
    trigger: 'Request Rate',
    maturity: 'Next',
    tags: ['requests', 'api', 'throughput'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'webhook-receiver-rps', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'webhook-receiver' },
        replicas: { min: 1, max: 30, headroom: { type: 'percent', value: 15 } },
        signal: { type: 'requests' }
      }
    }
  },
  {
    id: 'stream-lag',
    name: 'Stream Consumer Lag',
    description: 'Scale Kinesis stream consumers based on shard iterator lag.',
    useCase: 'Stream Processing',
    trigger: 'Kinesis Lag',
    maturity: 'Next',
    tags: ['kinesis', 'stream', 'lag'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'stream-processor-lag', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'stream-processor' },
        replicas: { min: 1, max: 50 },
        signal: { type: 'sqs' }
      }
    }
  },
  {
    id: 'eventbridge-spike',
    name: 'EventBridge Spike Buffer',
    description: 'Buffer EventBridge events through SQS and scale workers accordingly.',
    useCase: 'Event Handling',
    trigger: 'AWS EventBridge + SQS',
    maturity: 'Ready',
    tags: ['eventbridge', 'sqs', 'events'],
    template: {
      apiVersion: 'scaler.io/v1alpha1',
      kind: 'Scaler',
      metadata: { name: 'event-handler-sqs', namespace: 'production' },
      spec: {
        targetRef: { kind: 'Deployment', name: 'event-handler' },
        replicas: { min: 2, max: 75, headroom: { type: 'percent', value: 25 } },
        signal: { type: 'sqs' }
      }
    }
  }
]
