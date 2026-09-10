export function formatNumber(value: number, unit: string): string {
  if (unit === '%') return `${Math.round(value)}%`
  if (unit === 'msgs') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return `${Math.round(value)}`
  }
  if (unit === 'req/s') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return `${Math.round(value)}`
  }
  return value.toString()
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
