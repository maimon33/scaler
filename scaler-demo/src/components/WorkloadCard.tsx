import { Workload } from '../types'
import { formatNumber, formatRelativeTime } from '../utils/formatters'

interface WorkloadCardProps {
  workload: Workload
  onSelect: () => void
}

export function WorkloadCard({ workload, onSelect }: WorkloadCardProps) {
  const statusColors = {
    'Running': 'bg-secondary',
    'Scaling': 'bg-tertiary',
    'Paused': 'bg-outline',
    'Recommended': 'bg-primary'
  }

  const metricColor = {
    'cpu': 'text-secondary',
    'sqs': 'text-tertiary',
    'requests': 'text-primary',
    'schedule': 'text-outline'
  }

  return (
    <button
      onClick={onSelect}
      className="card hover:border-primary/50 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-headline font-bold text-lg">{workload.name}</h3>
          <p className="text-xs text-outline-variant">{workload.kind} · {workload.namespace}</p>
        </div>
        <span className={`w-2 h-2 rounded-full ${statusColors[workload.status]}`}></span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-container-lowest p-3 rounded-lg">
          <p className="metric-label">Replicas</p>
          <p className="metric-value">{workload.currentReplicas}</p>
          <p className="text-xs text-outline-variant mt-1">
            {workload.status === 'Scaling' ? `→ ${workload.desiredReplicas}` : `/ ${workload.maxReplicas}`}
          </p>
        </div>
        <div className={`bg-surface-container-lowest p-3 rounded-lg ${metricColor[workload.primaryMetric]}`}>
          <p className="metric-label">{workload.primaryMetric.toUpperCase()}</p>
          <p className="metric-value">{formatNumber(workload.metricValue, workload.metricUnit)}</p>
          <p className="text-xs mt-1 opacity-75">{workload.primaryMetric === 'sqs' ? 'queue msgs' : workload.primaryMetric === 'requests' ? 'req/sec' : 'utilization'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-outline-variant">
        <span>{workload.status}</span>
        {workload.lastScaledAt && (
          <span>Scaled {formatRelativeTime(workload.lastScaledAt)}</span>
        )}
      </div>
    </button>
  )
}
