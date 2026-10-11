import type { Adjudicator, AdjudicatorPin, Panel } from '@bis/shared'
import { currentCompetitionId } from './competitions.ts'
import { currentEvents } from './events.ts'

const NAMES = [
  'Lorenzo V. Aguilar', 'Patricia M. Dizon', 'Ramon T. Hernandez', 'Celeste B. Ilagan',
  'Victor L. Manalo', 'Rowena S. Panganiban', 'Dionisio C. Quizon', 'Helena P. Sarmiento',
  'Alfredo G. Tabora', 'Cecilia R. Ventura',
]

export const adjudicators: Adjudicator[] = NAMES.map((name, i) => ({
  id: `adj-${String.fromCharCode(97 + i)}`,
  name,
  letter: String.fromCharCode(65 + i),
}))

// Sample PINs: 4 digits, fixed so a tester can sign in
export const adjudicatorPins: AdjudicatorPin[] = adjudicators.map((a, i) => ({
  competitionId: currentCompetitionId,
  adjudicatorId: a.id,
  pin: String(4100 + i * 111),
}))

// Solo events use seven adjudicators (A to G); couple events use nine (A to I)
export const panels: Panel[] = currentEvents.map((event) => ({
  id: `panel-${event.id}`,
  eventId: event.id,
  adjudicatorIds: adjudicators.slice(0, event.isSolo ? 7 : 9).map((a) => a.id),
}))
