import { RoundStatus } from '@bis/shared'
import { Badge, type BadgeTone } from './ui/index.ts'

const LABEL: Record<RoundStatus, string> = {
  pending: 'Not started',
  marking: 'Marking',
  review: 'In review',
  approved: 'Approved',
  published: 'Published',
}

const TONE: Record<RoundStatus, BadgeTone> = {
  [RoundStatus.Pending]: 'neutral',
  [RoundStatus.Marking]: 'gold',
  [RoundStatus.Review]: 'warning',
  [RoundStatus.Approved]: 'success',
  [RoundStatus.Published]: 'success',
}

export const ROUND_STATUS_LABEL = LABEL

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  return (
    <Badge pill tone={TONE[status]}>
      {LABEL[status]}
    </Badge>
  )
}
