import type { StageId } from '../lib/types'
import { stageInfo } from '../lib/types'
import { FOLLOW_UP_BUCKETS, followUpBucket } from '../lib/dates'

export function StageBadge({ stage, size = 'sm' }: { stage: StageId; size?: 'sm' | 'md' }) {
  const s = stageInfo(stage)
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${s.badge} ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      {s.label}
    </span>
  )
}

export function FollowUpBadge({ date }: { date: string }) {
  const b = FOLLOW_UP_BUCKETS.find((x) => x.id === followUpBucket(date))!
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${b.badge}`}>
      {b.label}
    </span>
  )
}
