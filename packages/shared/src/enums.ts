export const Role = {
  Admin: 'admin',
  Secretariat: 'secretariat',
  Scrutineer: 'scrutineer',
  Chairperson: 'chairperson',
  Adjudicator: 'adjudicator',
  Mc: 'mc',
  Club: 'club',
  Public: 'public',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const PaymentStatus = {
  Unpaid: 'unpaid',
  ForChecking: 'for_checking',
  Approved: 'approved',
  Rejected: 'rejected',
  PaidAtVenue: 'paid_at_venue',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const RoundType = {
  Round1: 'round_1',
  Round2: 'round_2',
  QuarterFinal: 'quarter_final',
  SemiFinal: 'semi_final',
  Final: 'final',
} as const
export type RoundType = (typeof RoundType)[keyof typeof RoundType]

export const RoundStatus = {
  Pending: 'pending',
  Marking: 'marking',
  Review: 'review',
  Approved: 'approved',
  Published: 'published',
} as const
export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus]

export const SubmissionStatus = {
  Waiting: 'waiting',
  Marking: 'marking',
  Submitted: 'submitted',
} as const
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

export const AgeGroup = {
  Juvenile: 'juvenile',
  Junior1: 'junior_1',
  Junior2: 'junior_2',
  Youth: 'youth',
  Adult: 'adult',
  Senior: 'senior',
} as const
export type AgeGroup = (typeof AgeGroup)[keyof typeof AgeGroup]

export const Class = {
  E1: 'E1',
  D: 'D',
  C: 'C',
  B: 'B',
  A: 'A',
} as const
export type Class = (typeof Class)[keyof typeof Class]

export const Discipline = {
  Latin: 'latin',
  Standard: 'standard',
} as const
export type Discipline = (typeof Discipline)[keyof typeof Discipline]

export const Dance = {
  Samba: 'samba',
  ChaChaCha: 'cha_cha_cha',
  Rumba: 'rumba',
  PasoDoble: 'paso_doble',
  Jive: 'jive',
  Waltz: 'waltz',
  Tango: 'tango',
  VienneseWaltz: 'viennese_waltz',
  Foxtrot: 'foxtrot',
  Quickstep: 'quickstep',
} as const
export type Dance = (typeof Dance)[keyof typeof Dance]
