import type { Dance, EventReport, EventReportPerson, EventReportPlaced, EventReportRound, Id, RoundType } from '@bis/shared'
import { placeFinal } from './final.ts'

export interface ReportMark {
  adjudicatorId: Id
  competitorId: Id
  dance: Dance
  placing: number | null
  kind: 'x' | 'placing'
}

export interface ReportRoundInput {
  type: RoundType
  isFinal: boolean
  // Those who marked, in letter order
  adjudicators: Array<{ id: Id; letter: string }>
  field: Id[]
  marks: ReportMark[]
}

export interface ReportInput {
  // Published rounds, first round first
  rounds: ReportRoundInput[]
  people: Map<Id, EventReportPerson>
  results: Array<{ competitorId: Id; place: number; placeFrom: number; placeTo: number }>
}

const dancesOf = (marks: ReportMark[]) => [...new Set(marks.map((m) => m.dance))]

// What each adjudicator gave one competitor in one dance: the placing, 1 for an X, or nothing
function cells(round: ReportRoundInput, competitorId: Id, dance: Dance): Array<number | null> {
  return round.adjudicators.map((a) => {
    const mark = round.marks.find((m) => m.adjudicatorId === a.id && m.competitorId === competitorId && m.dance === dance)
    if (!mark) return null
    return mark.kind === 'placing' ? mark.placing : 1
  })
}

function finalReport(round: ReportRoundInput, people: ReportInput['people']): EventReportRound {
  const placings = round.marks.filter((m) => m.kind === 'placing')
  const dances = dancesOf(placings)
  const competitorIds = [...new Set(placings.map((m) => m.competitorId))]
  const placed = placeFinal({
    competitorIds,
    adjudicatorIds: round.adjudicators.map((a) => a.id),
    dances: dances.map((dance) => ({
      dance,
      marks: placings.filter((m) => m.dance === dance).map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, placing: m.placing ?? 0 })),
    })),
  })
  return {
    roundType: round.type,
    isFinal: true,
    dances,
    letters: round.adjudicators.map((a) => a.letter),
    rows: placed.rows.map((r) => ({
      ...person(people, r.competitorId),
      perDance: dances.map((dance) => ({ dance, marks: cells(round, r.competitorId, dance), place: r.dancePlaces[dance] ?? null })),
      place: r.announcedPlace,
      total: r.total,
      recalled: null,
    })),
  }
}

function earlierReport(round: ReportRoundInput, next: ReportRoundInput | undefined, people: ReportInput['people']): EventReportRound {
  const xs = round.marks.filter((m) => m.kind === 'x')
  const dances = dancesOf(xs)
  const through = new Set(next?.field ?? [])
  const rows = round.field.map((competitorId) => ({
    ...person(people, competitorId),
    perDance: dances.map((dance) => ({ dance, marks: cells(round, competitorId, dance), place: null })),
    place: null,
    total: xs.filter((m) => m.competitorId === competitorId).length,
    recalled: through.has(competitorId),
  }))
  rows.sort((a, b) => b.total - a.total || (a.backNumber ?? 0) - (b.backNumber ?? 0))
  return { roundType: round.type, isFinal: false, dances, letters: round.adjudicators.map((a) => a.letter), rows }
}

const person = (people: ReportInput['people'], competitorId: Id): EventReportPerson =>
  people.get(competitorId) ?? { competitorId, backNumber: null, names: [], team: '' }

// The tables of the printed result sheet, built from a published event's rounds and results
export function buildEventReport(input: ReportInput): Pick<EventReport, 'listing' | 'ranking' | 'rounds'> {
  const { rounds, people, results } = input
  const resultOf = new Map(results.map((r) => [r.competitorId, r]))
  const placed = (competitorId: Id): EventReportPlaced => {
    const r = resultOf.get(competitorId)
    return { ...person(people, competitorId), place: r?.place ?? 0, placeFrom: r?.placeFrom ?? r?.place ?? 0, placeTo: r?.placeTo ?? r?.place ?? 0 }
  }
  const byPlace = (a: EventReportPlaced, b: EventReportPlaced) => a.place - b.place || (a.backNumber ?? 0) - (b.backNumber ?? 0)

  const reports = rounds.map((round, i) => (round.isFinal ? finalReport(round, people) : earlierReport(round, rounds[i + 1], people)))

  // The final's field, then those cut in each earlier round, latest first
  const listing = [...rounds].reverse().map((round) => {
    const i = rounds.indexOf(round)
    const next = rounds[i + 1]
    const ids = round.isFinal ? round.field : round.field.filter((id) => !next?.field.includes(id))
    return { roundType: round.type, isFinal: round.isFinal, rows: ids.map(placed).sort(byPlace) }
  })

  const everyone = [...new Set(rounds.flatMap((r) => r.field))]
  const ranking = everyone
    .map((competitorId) => ({
      ...placed(competitorId),
      rounds: [...rounds].reverse().flatMap((round, k) => {
        const report = reports[rounds.length - 1 - k]!
        const row = report.rows.find((r) => r.competitorId === competitorId)
        if (!row) return []
        return [{ roundType: round.type, isFinal: round.isFinal, value: round.isFinal ? (row.place ?? 0) : row.total }]
      }),
    }))
    .sort(byPlace)

  return { listing, ranking, rounds: [...reports].reverse() }
}
