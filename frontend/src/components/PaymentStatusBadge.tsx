import type { PaymentStatus } from '@bis/shared'
import { PAYMENT_STATUS_LABEL } from '../lib/format.ts'
import { Badge, type BadgeTone } from './ui/index.ts'

const TONE: Record<PaymentStatus, BadgeTone> = {
  unpaid: 'neutral',
  for_checking: 'gold',
  approved: 'success',
  rejected: 'danger',
  paid_at_venue: 'success',
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge pill tone={TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>
}
