import { createContext, useContext, useReducer, ReactNode } from 'react'
import type { ScalingAction, Pattern, ScalerDefinition, ScalerStore } from '../types'
import { INITIAL_WORKLOADS } from '../data/workloads'

type Action =
  | { type: 'SET_WORKLOAD_REPLICAS'; workloadId: string; desiredReplicas: number }
  | { type: 'ADD_SCALING_ACTION'; action: ScalingAction }
  | { type: 'SET_CURRENT_SCENARIO'; scenarioId: string }
  | { type: 'SET_SELECTED_WORKLOAD'; workloadId: string | null }
  | { type: 'SET_PATTERN_EDIT'; pattern: Pattern | null }
  | { type: 'SET_EDITING_DEFINITION'; definition: ScalerDefinition | null }
  | { type: 'UPDATE_WORKLOAD_METRIC'; workloadId: string; metricValue: number }

const initialState: ScalerStore = {
  workloads: INITIAL_WORKLOADS,
  scalingActions: [],
  currentScenario: 'normal',
  currentPattern: null,
  editingDefinition: null,
  selectedWorkloadId: null
}

function scaleReducer(state: ScalerStore, action: Action): ScalerStore {
  switch (action.type) {
    case 'SET_WORKLOAD_REPLICAS': {
      const workload = state.workloads.find(w => w.id === action.workloadId)
      if (!workload) return state

      return {
        ...state,
        workloads: state.workloads.map(w =>
          w.id === action.workloadId
            ? {
                ...w,
                desiredReplicas: Math.max(w.minReplicas, Math.min(w.maxReplicas, action.desiredReplicas)),
                status: action.desiredReplicas !== w.currentReplicas ? 'Scaling' : 'Running',
                lastScaledAt: new Date()
              }
            : w
        )
      }
    }
    case 'ADD_SCALING_ACTION': {
      return {
        ...state,
        scalingActions: [action.action, ...state.scalingActions].slice(0, 50)
      }
    }
    case 'SET_CURRENT_SCENARIO': {
      return { ...state, currentScenario: action.scenarioId }
    }
    case 'SET_SELECTED_WORKLOAD': {
      return { ...state, selectedWorkloadId: action.workloadId }
    }
    case 'SET_PATTERN_EDIT': {
      return { ...state, currentPattern: action.pattern }
    }
    case 'SET_EDITING_DEFINITION': {
      return { ...state, editingDefinition: action.definition }
    }
    case 'UPDATE_WORKLOAD_METRIC': {
      return {
        ...state,
        workloads: state.workloads.map(w =>
          w.id === action.workloadId
            ? { ...w, metricValue: action.metricValue }
            : w
        )
      }
    }
    default:
      return state
  }
}

type ScalerContextType = {
  store: ScalerStore
  dispatch: React.Dispatch<Action>
}

const ScalerContext = createContext<ScalerContextType | undefined>(undefined)

export function ScalerProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(scaleReducer, initialState)
  return (
    <ScalerContext.Provider value={{ store, dispatch }}>
      {children}
    </ScalerContext.Provider>
  )
}

export function useScalerStore() {
  const context = useContext(ScalerContext)
  if (!context) {
    throw new Error('useScalerStore must be used within ScalerProvider')
  }

  const { store, dispatch } = context

  return {
    store,
    updateWorkloadReplicas: (workloadId: string, desiredReplicas: number) => {
      const workload = store.workloads.find(w => w.id === workloadId)
      if (!workload) return

      dispatch({ type: 'SET_WORKLOAD_REPLICAS', workloadId, desiredReplicas })

      dispatch({
        type: 'ADD_SCALING_ACTION',
        action: {
          id: `action-${Date.now()}`,
          workloadId,
          timestamp: new Date(),
          fromReplicas: workload.currentReplicas,
          toReplicas: desiredReplicas,
          trigger: 'manual'
        }
      })
    },
    recordScalingAction: (action: ScalingAction) => {
      dispatch({ type: 'ADD_SCALING_ACTION', action })
    },
    setCurrentScenario: (scenarioId: string) => {
      dispatch({ type: 'SET_CURRENT_SCENARIO', scenarioId })
    },
    setSelectedWorkload: (workloadId: string | null) => {
      dispatch({ type: 'SET_SELECTED_WORKLOAD', workloadId })
    },
    setPatternEdit: (pattern: Pattern | null) => {
      dispatch({ type: 'SET_PATTERN_EDIT', pattern })
    },
    setEditingDefinition: (definition: ScalerDefinition | null) => {
      dispatch({ type: 'SET_EDITING_DEFINITION', definition })
    },
    updateWorkloadMetric: (workloadId: string, metricValue: number) => {
      dispatch({ type: 'UPDATE_WORKLOAD_METRIC', workloadId, metricValue })
    }
  }
}
