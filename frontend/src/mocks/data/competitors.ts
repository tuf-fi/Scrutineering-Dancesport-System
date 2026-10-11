import type { Competitor } from '@bis/shared'
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

const SOLOS = 90
const COUPLES = 30

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

const backNumbers = shuffle(Array.from({ length: 299 }, (_, i) => i + 1), rng)

function make(index: number, names: string[]): Competitor {
  return {
    id: `c-${String(index + 1).padStart(3, '0')}`,
    names,
    backNumber: backNumbers[index],
    clubId: pick(clubs, rng).id,
  }
}

export const soloCompetitors: Competitor[] = Array.from({ length: SOLOS }, (_, i) =>
  make(i, [personName()]),
)

export const coupleCompetitors: Competitor[] = Array.from({ length: COUPLES }, (_, i) =>
  make(SOLOS + i, [personName(), personName()]),
)

export const competitors: Competitor[] = [...soloCompetitors, ...coupleCompetitors]
