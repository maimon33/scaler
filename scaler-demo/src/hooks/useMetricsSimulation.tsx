import { useEffect, useRef } from 'react'
import { useScalerStore } from './useScalerStore'
import { SCENARIOS } from '../data/scenarios'

export function useMetricsSimulation() {
  const { store, updateWorkloadMetric } = useScalerStore()
  const generatorsRef = useRef<Record<string, () => number>>({})

  useEffect(() => {
    const scenario = SCENARIOS.find(s => s.id === store.currentScenario)
    if (!scenario) return

    generatorsRef.current = scenario.metricGenerators
  }, [store.currentScenario])

  useEffect(() => {
    const interval = setInterval(() => {
      store.workloads.forEach(workload => {
        const generatorKey = `${workload.id}-${workload.primaryMetric === 'sqs' ? 'sqs' : workload.primaryMetric === 'requests' ? 'rps' : 'cpu'}`
        const generator = generatorsRef.current[generatorKey]

        if (generator) {
          const newValue = generator()
          updateWorkloadMetric(workload.id, newValue)
        }
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [store.workloads, updateWorkloadMetric])
}
