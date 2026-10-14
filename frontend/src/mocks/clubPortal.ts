import {
  PaymentStatus,
  Role,
  type AgeGroup,
  type ClubDancer,
  type ClubSignUp,
  type Competitor,
  type Entry,
  type EntryOption,
  type PaymentDetail,
  type PaymentMethod,
  type SessionUser,
} from '@bis/shared'
import { clubs } from './data/clubs.ts'
import { currentCompetitionId } from './data/competitions.ts'
import { ageGroupOf, competitors } from './data/competitors.ts'
import { entries, paymentIdForClub } from './data/entries.ts'
import { events } from './data/events.ts'
import { feeFor, paymentDetail, payments } from './data/payments.ts'

const found = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`${what} not found`)
  return value
}

// TODO: fake club passwords; phase 3 uses real accounts. Clubs that sign up here keep their own password.
export const clubPasswords = new Map<string, string>()

export function signUpClub(input: ClubSignUp): SessionUser {
  const email = input.contactEmail.trim().toLowerCase()
  if (!input.name.trim() || !input.contactName.trim()) throw new Error('Enter the club name and a contact person.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
  if (input.password.length < 8) throw new Error('Use a password of at least 8 characters.')
  if (clubs.some((c) => c.contactEmail === email)) throw new Error('A club with this email already exists. Sign in instead.')
  if (clubs.some((c) => c.name.toLowerCase() === input.name.trim().toLowerCase())) {
    throw new Error('A club with this name already exists.')
  }
  const club = {
    id: `club-${clubs.length + 1}`,
    name: input.name.trim(),
    contactName: input.contactName.trim(),
    contactEmail: email,
    contactPhone: input.contactPhone.trim(),
  }
  clubs.push(club)
  clubPasswords.set(club.id, input.password)
  return { id: club.id, name: club.name, role: Role.Club }
}

const activeEntries = (competitorId: string) => entries.filter((e) => e.competitorId === competitorId && !e.scratched)

const own = (clubId: string, dancerId: string): Competitor => {
  const dancer = competitors.find((c) => c.id === dancerId)
  if (!dancer || dancer.clubId !== clubId) throw new Error('That dancer is not in your club.')
  return dancer
}

const view = (c: Competitor): ClubDancer => ({
  id: c.id,
  names: c.names,
  ageGroup: ageGroupOf.get(c.id) ?? null,
  entryCount: activeEntries(c.id).length,
})

export const clubDancers = (clubId: string): ClubDancer[] => competitors.filter((c) => c.clubId === clubId).map(view)

function cleanNames(names: string[]) {
  const cleaned = names.map((n) => n.trim()).filter(Boolean)
  if (cleaned.length < 1 || cleaned.length > 2) throw new Error('A dancer is one person or a couple.')
  return cleaned
}

export function saveDancer(clubId: string, input: { names: string[]; ageGroup: AgeGroup }, id?: string): ClubDancer {
  const names = cleanNames(input.names)
  if (id) {
    const dancer = own(clubId, id)
    if (names.length !== dancer.names.length && activeEntries(id).length > 0) {
      throw new Error('Withdraw their entries before changing between a solo dancer and a couple.')
    }
    dancer.names = names
    ageGroupOf.set(id, input.ageGroup)
    return view(dancer)
  }
  const dancer: Competitor = {
    id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
    names,
    backNumber: null,
    clubId,
  }
  competitors.push(dancer)
  ageGroupOf.set(dancer.id, input.ageGroup)
  return view(dancer)
}

export function deleteDancer(clubId: string, id: string): void {
  const dancer = own(clubId, id)
  if (entries.some((e) => e.competitorId === id)) throw new Error('This dancer has entries. Withdraw them first.')
  competitors.splice(competitors.indexOf(dancer), 1)
  ageGroupOf.delete(id)
}

// The club's main payment covers every entry made through the portal
const clubPayment = (clubId: string) => payments.find((p) => p.id === paymentIdForClub(clubId))

const canChange = (status: PaymentStatus | undefined) =>
  status === undefined || status === PaymentStatus.Unpaid || status === PaymentStatus.Rejected

export function entryOptions(clubId: string, dancerId: string): EntryOption[] {
  const dancer = own(clubId, dancerId)
  const age = ageGroupOf.get(dancerId)
  const solo = dancer.names.length === 1
  return events
    .filter((e) => e.competitionId === currentCompetitionId && e.isSolo === solo && (!age || e.ageGroup === age))
    .sort((a, b) => a.number - b.number)
    .map((e) => {
      const entry = entries.find((x) => x.eventId === e.id && x.competitorId === dancerId && !x.scratched)
      const payment = payments.find((p) => p.id === entry?.paymentId)
      return {
        eventId: e.id,
        eventNumber: e.number,
        dances: e.dances,
        ageGroup: e.ageGroup,
        class: e.class,
        discipline: e.discipline,
        fee: feeFor(e),
        entered: Boolean(entry),
        locked: Boolean(entry) && !canChange(payment?.status),
      }
    })
}

function recomputeDue(clubId: string) {
  const payment = clubPayment(clubId)
  if (!payment) return
  payment.entryIds = entries.filter((e) => e.paymentId === payment.id).map((e) => e.id)
  payment.amountDue = payment.entryIds.reduce((sum, id) => {
    const event = events.find((ev) => ev.id === entries.find((e) => e.id === id)?.eventId)
    return sum + (event ? feeFor(event) : 0)
  }, 0)
}

export function registerEntries(clubId: string, dancerId: string, eventIds: string[]): void {
  own(clubId, dancerId)
  const options = entryOptions(clubId, dancerId)
  const wanted = new Set(eventIds)
  if ([...wanted].some((id) => !options.some((o) => o.eventId === id))) {
    throw new Error('One of those events is not open to this dancer.')
  }
  const adding = options.filter((o) => wanted.has(o.eventId) && !o.entered)
  const removing = options.filter((o) => !wanted.has(o.eventId) && o.entered)
  if (removing.some((o) => o.locked)) throw new Error('An entry that is already paid cannot be withdrawn here. Ask the secretariat.')

  let payment = clubPayment(clubId)
  if (adding.length > 0 && !canChange(payment?.status)) {
    throw new Error('Your payment is already with the secretariat. Ask them to add late entries.')
  }
  if (adding.length > 0 && !payment) {
    payment = {
      id: paymentIdForClub(clubId),
      clubId,
      entryIds: [],
      amountDue: 0,
      amountPaid: null,
      referenceNumber: null,
      receiptUrl: null,
      status: PaymentStatus.Unpaid,
      rejectionReason: null,
      checkedBy: null,
      checkedAt: null,
    }
    payments.push(payment)
  }

  for (const o of removing) {
    const index = entries.findIndex((e) => e.eventId === o.eventId && e.competitorId === dancerId && !e.scratched)
    if (index >= 0) entries.splice(index, 1)
  }
  for (const o of adding) {
    const entry: Entry = {
      id: `${o.eventId}:${dancerId}`,
      eventId: o.eventId,
      competitorId: dancerId,
      scratched: false,
      paymentId: payment!.id,
    }
    const old = entries.findIndex((e) => e.id === entry.id)
    if (old >= 0) entries.splice(old, 1)
    entries.push(entry)
  }
  recomputeDue(clubId)
}

export const clubPayments = (clubId: string): PaymentDetail[] =>
  payments.filter((p) => p.clubId === clubId).map(paymentDetail)

// Sample payment details; a real server has the organizer's own
export const paymentMethods = (): PaymentMethod[] => [
  { name: 'GCash', accountName: 'BN IT Scrutineer', number: '0917 000 0000' },
  { name: 'Maya', accountName: 'BN IT Scrutineer', number: '0918 000 0000' },
  { name: 'Bank transfer', accountName: 'BN IT Scrutineer', number: '0000 0000 0000', note: 'BDO Savings, Sorsogon branch' },
]

export function submitPaymentProof(
  clubId: string,
  input: { amountPaid: number; referenceNumber: string; receiptUrl: string },
): void {
  const payment = found(clubPayment(clubId), 'Payment')
  if (!canChange(payment.status)) throw new Error('Your payment has already been sent for checking.')
  if (payment.amountDue <= 0) throw new Error('Register dancers to events before paying.')
  if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) throw new Error('Enter the amount you sent.')
  if (!input.referenceNumber.trim()) throw new Error('Enter the reference number from your receipt.')
  if (!input.receiptUrl) throw new Error('Upload a screenshot of your receipt.')
  payment.amountPaid = input.amountPaid
  payment.referenceNumber = input.referenceNumber.trim()
  payment.receiptUrl = input.receiptUrl
  payment.status = PaymentStatus.ForChecking
  payment.rejectionReason = null
}
