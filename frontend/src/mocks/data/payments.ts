import { PaymentStatus, type Payment } from '@bis/shared'
import { clubs } from './clubs.ts'
import { entries, paymentIdForClub } from './entries.ts'
import { events } from './events.ts'
import { at } from './rng.ts'

const FEE_SOLO = 500
const FEE_COUPLE = 800

// One payment per club, cycling through every status so each queue state has data
const STATUS_CYCLE = [
  PaymentStatus.Approved,
  PaymentStatus.ForChecking,
  PaymentStatus.Rejected,
  PaymentStatus.Unpaid,
  PaymentStatus.PaidAtVenue,
  PaymentStatus.ForChecking,
  PaymentStatus.Approved,
  PaymentStatus.ForChecking,
]

const eventById = new Map(events.map((e) => [e.id, e]))

export const payments: Payment[] = clubs.flatMap((club, i) => {
  const id = paymentIdForClub(club.id)
  const own = entries.filter((e) => e.paymentId === id)
  if (own.length === 0) return []

  const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
  const amountDue = own.reduce(
    (sum, e) => sum + (eventById.get(e.eventId)?.isSolo ? FEE_SOLO : FEE_COUPLE),
    0,
  )
  const hasProof = status !== PaymentStatus.Unpaid && status !== PaymentStatus.PaidAtVenue
  const decided = status === PaymentStatus.Approved || status === PaymentStatus.Rejected

  return [
    {
      id,
      clubId: club.id,
      entryIds: own.map((e) => e.id),
      amountDue,
      amountPaid: hasProof ? (status === PaymentStatus.Rejected ? amountDue - FEE_SOLO : amountDue) : null,
      referenceNumber: hasProof ? `GC${String(7_400_000_000 + i * 913_457).slice(0, 10)}` : null,
      // TODO: replace with a real uploaded screenshot when the backend stores receipts
      receiptUrl: hasProof ? `/mock/receipt-${i + 1}.png` : null,
      status,
      rejectionReason:
        status === PaymentStatus.Rejected ? 'Amount sent does not match the GCash record.' : null,
      checkedBy: decided ? 'staff-admin' : null,
      checkedAt: decided ? at(-20_000 + i * 60) : null,
    } satisfies Payment,
  ]
})
