import { useState } from 'react'
import { Workload } from '../types'
import { useScalerStore } from '../hooks/useScalerStore'
import { formatNumber, formatRelativeTime } from '../utils/formatters'
import { validateReplicas } from '../utils/validators'

interface ScalingPanelProps {
  workload: Workload | null
  isOpen: boolean
  onClose: () => void
}

export function ScalingPanel({ workload, isOpen, onClose }: ScalingPanelProps) {
  const { store, updateWorkloadReplicas } = useScalerStore()
  const [inputValue, setInputValue] = useState('')

  if (!isOpen || !workload) return null

  const handleScale = () => {
    const value = parseInt(inputValue, 10)
    if (!isNaN(value)) {
      const validated = validateReplicas(value, workload.minReplicas, workload.maxReplicas)
      updateWorkloadReplicas(workload.id, validated)
      setInputValue('')
    }
  }

  const recentActions = store.scalingActions
    .filter(a => a.workloadId === workload.id)
    .slice(0, 5)

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>}
      <div className={`fixed right-0 top-0 h-full w-96 bg-surface-container-low border-l border-outline-variant/20 shadow-2xl transform transition-transform z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline text-2xl font-bold">{workload.name}</h2>
            <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-6">
            <div className="card">
              <p className="metric-label mb-2">Current Replicas</p>
              <p className="metric-value text-secondary">{workload.currentReplicas}</p>
              <p className="text-sm text-outline-variant mt-2">Min: {workload.minReplicas} · Max: {workload.maxReplicas}</p>
            </div>

            {workload.status === 'Scaling' && (
              <div className="card bg-tertiary/10 border-tertiary/30">
                <p className="metric-label mb-2 text-tertiary">Desired Replicas</p>
                <p className="metric-value text-tertiary">{workload.desiredReplicas}</p>
                <p className="text-sm text-outline-variant mt-2">Scaling in progress...</p>
              </div>
            )}

            <div className="card">
              <p className="metric-label mb-2">{workload.primaryMetric.toUpperCase()} Metric</p>
              <p className="metric-value text-primary">{formatNumber(workload.metricValue, workload.metricUnit)}</p>
              <p className="text-sm text-outline-variant mt-2">{workload.primaryMetric} utilization</p>
            </div>

            <div className="space-y-3">
              <label className="metric-label">Scale to replicas</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  min={workload.minReplicas}
                  max={workload.maxReplicas}
                  placeholder={String(workload.currentReplicas)}
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface"
                />
                <button
                  onClick={handleScale}
                  disabled={!inputValue}
                  className="btn-primary disabled:opacity-50"
                >
                  Scale
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[workload.minReplicas, Math.round((workload.minReplicas + workload.maxReplicas) / 2), workload.maxReplicas].map(val => (
                  <button
                    key={val}
                    onClick={() => setInputValue(String(val))}
                    className="btn-secondary text-xs"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {recentActions.length > 0 && (
              <div className="space-y-3">
                <p className="metric-label">Recent Actions</p>
                <div className="space-y-2">
                  {recentActions.map(action => (
                    <div key={action.id} className="bg-surface-container p-3 rounded-lg text-sm">
                      <p className="font-semibold">{action.fromReplicas} → {action.toReplicas}</p>
                      <p className="text-xs text-outline-variant">{formatRelativeTime(action.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
