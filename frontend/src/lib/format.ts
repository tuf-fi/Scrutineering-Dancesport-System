import type {
  AgeGroup,
  Dance,
  Discipline,
  Event,
  PaymentStatus,
  Role,
  RoundType,
} from '@bis/shared'

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  juvenile: 'Juvenile',
  junior_1: 'Junior I',
  junior_2: 'Junior II',
  youth: 'Youth',
  adult: 'Adult',
  senior: 'Senior',
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  latin: 'Latin',
  standard: 'Standard',
}

export const DANCE_LABEL: Record<Dance, string> = {
  samba: 'Samba',
  cha_cha_cha: 'Cha Cha Cha',
  rumba: 'Rumba',
  paso_doble: 'Paso Doble',
  jive: 'Jive',
  waltz: 'Waltz',
  tango: 'Tango',
  viennese_waltz: 'Viennese Waltz',
  foxtrot: 'Foxtrot',
  quickstep: 'Quickstep',
}

export const ROUND_TYPE_LABEL: Record<RoundType, string> = {
  round_1: 'Round 1',
  round_2: 'Round 2',
  quarter_final: 'Quarter-final',
  semi_final: 'Semi-final',
  final: 'Final',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  for_checking: 'For checking',
  approved: 'Approved',
  rejected: 'Rejected',
  paid_at_venue: 'Paid at venue',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  secretariat: 'Secretariat',
  scrutineer: 'Scrutineer',
  chairperson: 'Chairperson of Adjudicators',
  adjudicator: 'Adjudicator',
  mc: 'MC',
  club: 'Club',
  public: 'Public',
}

// "10 October 2026"
export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// The event number as printed on sheets, e.g. E47
export const eventCode = (event: Pick<Event, 'number'>) => `E${event.number}`

export const eventDances = (event: Pick<Event, 'dances'>) =>
  event.dances.map((d) => DANCE_LABEL[d]).join(', ')

// "Junior I · E1 · Latin"
export const eventGrade = (event: Pick<Event, 'ageGroup' | 'class' | 'discipline'>) =>
  `${AGE_GROUP_LABEL[event.ageGroup]} · ${event.class} · ${DISCIPLINE_LABEL[event.discipline]}`

export const competitorName = (names: string[]) => names.join(' & ')
