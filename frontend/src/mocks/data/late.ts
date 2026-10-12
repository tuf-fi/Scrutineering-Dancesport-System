import { PaymentStatus, type Entry } from '@bis/shared'
import { competitors, poolFor } from './competitors.ts'
import { currentEvents } from './events.ts'
import { entries } from './entries.ts'
import { feeFor, payments } from './payments.ts'
import { at } from './rng.ts'

// Entries added at the venue after the deadline: some paid in cash, some still owing
const SEED: Array<{ eventNumber: number; paidInCash: boolean }> = [
  { eventNumber: 2, paidInCash: true },
  { eventNumber: 3, paidInCash: true },
  { eventNumber: 7, paidInCash: false },
  { eventNumber: 12, paidInCash: true },
  { eventNumber: 20, paidInCash: false },
  { eventNumber: 29, paidInCash: true },
  { eventNumber: 38, paidInCash: false },
  { eventNumber: 45, paidInCash: true },
]

SEED.forEach(({ eventNumber, paidInCash }, i) => {
  const event = currentEvents.find((e) => e.number === eventNumber)
  if (!event) return
  const taken = new Set(entries.filter((e) => e.eventId === event.id).map((e) => e.competitorId))
  const competitor = poolFor(event.isSolo, event.ageGroup).find((c) => !taken.has(c.id))
  if (!competitor || !competitors.includes(competitor)) return

  const fee = feeFor(event)
  const paymentId = `pay-late-${i + 1}`
  const entry: Entry = {
    id: `${event.id}:${competitor.id}`,
    eventId: event.id,
    competitorId: competitor.id,
    scratched: false,
    paymentId,
    late: true,
  }
  entries.push(entry)
  payments.push({
    id: paymentId,
    clubId: competitor.clubId,
    entryIds: [entry.id],
    amountDue: fee,
    amountPaid: paidInCash ? fee : null,
    referenceNumber: null,
    receiptUrl: null,
    status: paidInCash ? PaymentStatus.PaidAtVenue : PaymentStatus.Unpaid,
    rejectionReason: null,
    checkedBy: paidInCash ? 'staff-secretariat' : null,
    checkedAt: paidInCash ? at(30 + i * 20) : null,
  })
})
