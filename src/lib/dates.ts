export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysFromToday(iso: string): number {
  const today = parseISODate(todayISO())
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86_400_000)
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export type FollowUpBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

export const FOLLOW_UP_BUCKETS: { id: FollowUpBucket; label: string; badge: string }[] = [
  { id: 'overdue', label: 'Overdue', badge: 'bg-red-50 text-red-700 ring-red-200' },
  { id: 'today', label: 'Today', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { id: 'week', label: 'This week', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { id: 'later', label: 'Later', badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  { id: 'none', label: 'No date', badge: 'bg-white text-slate-500 ring-slate-200' },
]

export function followUpBucket(iso: string): FollowUpBucket {
  if (!iso) return 'none'
  const diff = daysFromToday(iso)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'week'
  return 'later'
}
