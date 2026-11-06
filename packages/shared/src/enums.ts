export const Role = {
  Admin: 'admin',
  Secretariat: 'secretariat',
  Scrutineer: 'scrutineer',
  Chairperson: 'chairperson',
  Adjudicator: 'adjudicator',
  Athlete: 'athlete',
  Coach: 'coach',
  Team: 'team',
  Compere: 'compere',
  Barker: 'barker',
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

export const ProgramKind = {
  Round: 'round',
  Break: 'break',
  Awarding: 'awarding',
} as const
export type ProgramKind = (typeof ProgramKind)[keyof typeof ProgramKind]

export const ProgramStatus = {
  Upcoming: 'upcoming',
  Next: 'next',
  Current: 'current',
  Completed: 'completed',
} as const
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus]

export const SubmissionStatus = {
  Waiting: 'waiting',
  Marking: 'marking',
  Submitted: 'submitted',
} as const
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

export const AgeGroup = {
  Juvenile1: 'juvenile_1',
  Juvenile2: 'juvenile_2',
  Junior1: 'junior_1',
  Junior2: 'junior_2',
  Youth: 'youth',
  Adult: 'adult',
  Senior: 'senior',
} as const
// The ids the database starts with; the admin can add, rename and delete age groups, so an id is any string
export type AgeGroup = string

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

// The dances each discipline is danced in
export const DISCIPLINE_DANCES: Record<Discipline, Dance[]> = {
  latin: [Dance.Samba, Dance.ChaChaCha, Dance.Rumba, Dance.PasoDoble, Dance.Jive],
  standard: [Dance.Waltz, Dance.Tango, Dance.VienneseWaltz, Dance.Foxtrot, Dance.Quickstep],
}

// What kind of event it is, which sets its fee and who may enter
export const EventKind = {
  Standard: 'standard',
  Beginners: 'bgb',
  Ranking: 'ranking',
  InterElementary: 'inter_elementary',
  InterHighSchool: 'inter_high_school',
  InterCollegiate: 'inter_collegiate',
  // Open only to teams from one province
  Closed: 'closed',
} as const
// The ids the database starts with; the admin can add, rename and delete kinds, so an id is any string
export type EventKind = string

// How a team paid the secretariat
export const PayMethod = {
  Unpaid: 'unpaid',
  Cash: 'cash',
  GCash: 'gcash',
  Maya: 'maya',
  Bank: 'bank',
} as const
export type PayMethod = (typeof PayMethod)[keyof typeof PayMethod]
