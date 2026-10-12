import { AgeGroup, type Competitor } from '@bis/shared'
import { clubs } from './clubs.ts'
import { createRng, pick, shuffle } from './rng.ts'

// Invented names only; no real dancers appear in sample data
const FIRST = [
  'Mia', 'Lian', 'Ana', 'Paolo', 'Bea', 'Joaquin', 'Trisha', 'Miguel', 'Katrina', 'Rafael',
  'Denise', 'Carlo', 'Isabel', 'Nathan', 'Camille', 'Gabriel', 'Hannah', 'Julian', 'Sofia', 'Marco',
  'Yna', 'Elijah', 'Louise', 'Dominic', 'Pia', 'Andre', 'Margaux', 'Tomas', 'Selene', 'Jericho',
]
const LAST = [
  'Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino', 'Castillo',
  'Navarro', 'Domingo', 'Salazar', 'Rivera', 'Pascual', 'Soriano', 'Valdez', 'Lacson', 'Del Rosario', 'Abad',
  'Bernardo', 'Guevarra', 'Macaraeg', 'Tolentino', 'Zamora', 'Fernandez', 'Lim', 'Tan', 'Uy', 'Co',
]
const INITIALS = 'ABCDEFGHJKLMNPRST'

const AGE_GROUPS = Object.values(AgeGroup)
// Each dancer belongs to one age group, as in the real sport
const SOLOS_PER_AGE_GROUP = 40
const COUPLES_PER_AGE_GROUP = 12

const rng = createRng(11)
const used = new Set<string>()

function personName(): string {
  for (;;) {
    const name = `${pick(FIRST, rng)} ${pick(INITIALS.split(''), rng)}. ${pick(LAST, rng)}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
}

const backNumbers = shuffle(Array.from({ length: 400 }, (_, i) => i + 1), rng)

export const competitors: Competitor[] = []
export const ageGroupOf = new Map<string, AgeGroup>()
const solos = new Map<AgeGroup, Competitor[]>()
const couples = new Map<AgeGroup, Competitor[]>()

function add(ageGroup: AgeGroup, names: string[], into: Map<AgeGroup, Competitor[]>) {
  const index = competitors.length
  const competitor: Competitor = {
    id: `c-${String(index + 1).padStart(3, '0')}`,
    names,
    backNumber: backNumbers[index],
    clubId: pick(clubs, rng).id,
  }
  competitors.push(competitor)
  ageGroupOf.set(competitor.id, ageGroup)
  into.set(ageGroup, [...(into.get(ageGroup) ?? []), competitor])
}

for (const ageGroup of AGE_GROUPS) {
  for (let i = 0; i < SOLOS_PER_AGE_GROUP; i++) add(ageGroup, [personName()], solos)
}
for (const ageGroup of AGE_GROUPS) {
  for (let i = 0; i < COUPLES_PER_AGE_GROUP; i++) add(ageGroup, [personName(), personName()], couples)
}

export const poolFor = (isSolo: boolean, ageGroup: AgeGroup): Competitor[] =>
  (isSolo ? solos : couples).get(ageGroup) ?? []
