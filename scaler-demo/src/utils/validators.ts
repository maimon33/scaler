export function validateReplicas(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function validateHeadroom(type: 'percent' | 'replicas', value: number): boolean {
  if (type === 'percent') return value >= 0 && value <= 100
  return value >= 0
}
