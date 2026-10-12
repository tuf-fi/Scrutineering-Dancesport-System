import { PaymentStatus, type Event, type Payment, type PaymentDetail } from '@bis/shared'
import { clubs } from './clubs.ts'
import { competitors } from './competitors.ts'
import { entries, paymentIdForClub } from './entries.ts'
import { events } from './events.ts'
import { at } from './rng.ts'

const FEE_SOLO = 500
const FEE_COUPLE = 800

export const feeFor = (event: Pick<Event, 'isSolo'>) => (event.isSolo ? FEE_SOLO : FEE_COUPLE)

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
const competitorById = new Map(competitors.map((c) => [c.id, c]))
const entryById = new Map(entries.map((e) => [e.id, e]))

// TODO: replace with the real uploaded screenshot when the backend stores receipts
export function sampleReceipt(amount: number, reference: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="500" viewBox="0 0 360 500">
<rect width="360" height="500" fill="#f7f6f5"/>
<rect x="24" y="48" width="312" height="400" rx="12" fill="#fff" stroke="#e2dfdc"/>
<text x="180" y="100" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#7a736c">Payment sent</text>
<text x="180" y="150" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="700" fill="#171412">PHP ${amount.toLocaleString('en-US')}.00</text>
<line x1="48" y1="190" x2="312" y2="190" stroke="#e2dfdc"/>
<text x="48" y="230" font-family="sans-serif" font-size="13" fill="#7a736c">Reference no.</text>
<text x="48" y="254" font-family="monospace" font-size="16" fill="#171412">${reference}</text>
<text x="48" y="300" font-family="sans-serif" font-size="13" fill="#7a736c">Status</text>
<text x="48" y="324" font-family="sans-serif" font-size="16" fill="#171412">Successful</text>
<text x="180" y="478" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#a29b94">Sample screenshot</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const payments: Payment[] = clubs.flatMap((club, i) => {
  const id = paymentIdForClub(club.id)
  const own = entries.filter((e) => e.paymentId === id)
  if (own.length === 0) return []

  const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
  const amountDue = own.reduce((sum, e) => sum + feeFor(eventById.get(e.eventId) ?? { isSolo: true }), 0)
  const hasProof = status !== PaymentStatus.Unpaid && status !== PaymentStatus.PaidAtVenue
  const decided = status === PaymentStatus.Approved || status === PaymentStatus.Rejected
  const amountPaid = hasProof ? (status === PaymentStatus.Rejected ? amountDue - FEE_SOLO : amountDue) : null
  const referenceNumber = hasProof ? `GC${String(7_400_000_000 + i * 913_457).slice(0, 10)}` : null

  return [
    {
      id,
      clubId: club.id,
      entryIds: own.map((e) => e.id),
      amountDue,
      amountPaid,
      referenceNumber,
      receiptUrl: amountPaid && referenceNumber ? sampleReceipt(amountPaid, referenceNumber) : null,
      status,
      rejectionReason:
        status === PaymentStatus.Rejected ? 'Amount sent does not match the GCash record.' : null,
      checkedBy: decided ? 'staff-admin' : null,
      checkedAt: decided ? at(-20_000 + i * 60) : null,
    } satisfies Payment,
  ]
})

export function paymentDetail(payment: Payment): PaymentDetail {
  const lines = payment.entryIds
    .map((entryId) => entryById.get(entryId))
    .flatMap((entry) => {
      const event = entry && eventById.get(entry.eventId)
      const competitor = entry && competitorById.get(entry.competitorId)
      if (!entry || !event || !competitor) return []
      return [
        {
          entryId: entry.id,
          eventId: event.id,
          eventNumber: event.number,
          dances: event.dances,
          competitorNames: competitor.names,
          fee: feeFor(event),
        },
      ]
    })
    .sort((a, b) => a.eventNumber - b.eventNumber)

  return {
    ...payment,
    clubName: clubs.find((c) => c.id === payment.clubId)?.name ?? 'Unknown club',
    lines,
  }
}
