import { SCENARIOS } from '../data/scenarios'
import { useScalerStore } from '../hooks/useScalerStore'

export function ScenarioSelector() {
  const { store, setCurrentScenario } = useScalerStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="metric-label mb-3">Load Scenario</p>
        <p className="text-sm text-on-surface-variant mb-4">
          Switch scenarios to see how metrics change and affect scaling recommendations.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => setCurrentScenario(scenario.id)}
            className={`p-3 rounded-lg text-left transition-colors ${
              store.currentScenario === scenario.id
                ? 'bg-primary text-on-primary-fixed border border-primary'
                : 'bg-surface-container border border-outline-variant/30 hover:border-primary/50'
            }`}
          >
            <p className="font-semibold text-sm">{scenario.name}</p>
            <p className="text-xs text-outline-variant mt-1">{scenario.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
