import { AgeGroup, Class, Dance, Discipline, type Event } from '@bis/shared'
import { competitions, currentCompetitionId } from './competitions.ts'

const AGE_ORDER = [
  AgeGroup.Juvenile,
  AgeGroup.Junior1,
  AgeGroup.Junior2,
  AgeGroup.Youth,
  AgeGroup.Adult,
  AgeGroup.Senior,
]

type Spec = Pick<Event, 'class' | 'discipline' | 'dances' | 'isSolo'>

// Each age group runs the same nine events, so numbers are sequential from E1
const BLOCK: Spec[] = [
  { class: Class.E1, discipline: Discipline.Latin, dances: [Dance.Samba], isSolo: true },
  { class: Class.E1, discipline: Discipline.Latin, dances: [Dance.ChaChaCha], isSolo: true },
  { class: Class.E1, discipline: Discipline.Latin, dances: [Dance.Rumba], isSolo: true },
  { class: Class.E1, discipline: Discipline.Latin, dances: [Dance.Jive], isSolo: true },
  { class: Class.E1, discipline: Discipline.Standard, dances: [Dance.Waltz], isSolo: true },
  { class: Class.E1, discipline: Discipline.Standard, dances: [Dance.Tango], isSolo: true },
  { class: Class.E1, discipline: Discipline.Standard, dances: [Dance.Quickstep], isSolo: true },
  {
    class: Class.D,
    discipline: Discipline.Latin,
    dances: [Dance.ChaChaCha, Dance.Rumba, Dance.Jive],
    isSolo: false,
  },
  {
    class: Class.C,
    discipline: Discipline.Standard,
    dances: [Dance.Waltz, Dance.Tango, Dance.Quickstep],
    isSolo: false,
  },
]

function buildEvents(competitionId: string, ageGroups: number): Event[] {
  const out: Event[] = []
  let number = 1
  for (const ageGroup of AGE_ORDER.slice(0, ageGroups)) {
    for (const spec of BLOCK) {
      out.push({ id: `${competitionId}:e${number}`, competitionId, number, ageGroup, ...spec })
      number++
    }
  }
  return out
}

const [current, ...past] = competitions
const pastAgeGroups = [2, 2]

export const events: Event[] = [
  ...buildEvents(current.id, AGE_ORDER.length),
  ...past.flatMap((c, i) => buildEvents(c.id, pastAgeGroups[i])),
]

export const currentEvents = events.filter((e) => e.competitionId === currentCompetitionId)

function find(ageGroup: AgeGroup, dance: Dance): Event {
  const found = currentEvents.find(
    (e) =>
      e.ageGroup === ageGroup &&
      e.class === Class.E1 &&
      e.discipline === Discipline.Latin &&
      e.dances[0] === dance,
  )
  if (!found) throw new Error('Sample event missing')
  return found
}

// Event in progress: Junior I E1 Cha Cha Cha, a solo event with a large field
export const featuredEvent = find(AgeGroup.Junior1, Dance.ChaChaCha)
// Event already finished, with approved results
export const completedEvent = find(AgeGroup.Junior1, Dance.Rumba)
