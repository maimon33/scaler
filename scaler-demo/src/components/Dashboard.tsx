import { useScalerStore } from '../hooks/useScalerStore'
import { WorkloadCard } from './WorkloadCard'
import { ScalingPanel } from './ScalingPanel'
import { ScenarioSelector } from './ScenarioSelector'

export function Dashboard() {
  const { store, setSelectedWorkload } = useScalerStore()
  const selectedWorkload = store.workloads.find(w => w.id === store.selectedWorkloadId)

  const activeReplicas = store.workloads.reduce((sum, w) => sum + w.currentReplicas, 0)
  const pendingReplicas = store.workloads.reduce((sum, w) => sum + (w.desiredReplicas - w.currentReplicas), 0)

  return (
    <main className="min-h-screen bg-background">
      <section className="px-5 sm:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 mb-6">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="font-label text-[10px] tracking-[0.2em] text-secondary-fixed uppercase">Production cluster · EKS</span>
            </div>
            <h1 className="font-headline text-5xl sm:text-6xl font-bold tracking-tighter leading-[0.92] mb-4">
              Scaling overview <span className="text-primary">in one dashboard.</span>
            </h1>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="card">
              <p className="metric-label mb-2">Active Replicas</p>
              <p className="metric-value text-secondary">{activeReplicas}</p>
              {pendingReplicas > 0 && (
                <p className="text-xs text-tertiary mt-2">+{pendingReplicas} pending</p>
              )}
            </div>
            <div className="card">
              <p className="metric-label mb-2">Workloads</p>
              <p className="metric-value text-primary">{store.workloads.length}</p>
              <p className="text-xs text-outline-variant mt-2">
                {store.workloads.filter(w => w.status === 'Running').length} running
              </p>
            </div>
            <div className="card">
              <p className="metric-label mb-2">Recent Actions</p>
              <p className="metric-value text-tertiary">{store.scalingActions.length}</p>
              <p className="text-xs text-outline-variant mt-2">scaling events</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-headline text-2xl font-bold">Workloads</h2>
              <div className="grid gap-4">
                {store.workloads.map(workload => (
                  <WorkloadCard
                    key={workload.id}
                    workload={workload}
                    onSelect={() => setSelectedWorkload(workload.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="card">
                <ScenarioSelector />
              </div>
            </div>
          </div>
        </div>
      </section>

      <ScalingPanel
        workload={selectedWorkload ?? null}
        isOpen={store.selectedWorkloadId !== null}
        onClose={() => setSelectedWorkload(null)}
      />
    </main>
  )
}
