import type { SkatingRow, SkatingTable } from '@bis/shared'
import { Check } from 'lucide-react'
import { DANCE_LABEL, competitorName, ordinal } from '../lib/format.ts'

const placeRange = (k: number) => (k === 1 ? '1' : `1–${k}`)

const RULE_LABEL: Record<NonNullable<SkatingRow['decidedBy']>, string> = {
  total: '',
  rule10: 'Rule 10',
  rule11: 'Rule 11',
  shared: 'Shared',
}

// The count of marks at this place or better, ticked where the place was decided
function MajorityCell({ row, column }: { row: SkatingRow; column: number }) {
  const ticked = row.placedColumn === column
  return (
    <span className={ticked ? 'inline-flex items-center gap-1 font-semibold text-neutral-900' : undefined}>
      {row.majority[column - 1] ?? ''}
      {ticked && <Check aria-label="Place decided here" className="size-4 text-success" strokeWidth={2.5} />}
    </span>
  )
}

export function skatingColumns(table: SkatingTable) {
  const isPlacing = table.kind === 'placing'
  const dances = table.rows[0]?.dancePlaces ?? []
  const showRule = table.rows.some((r) => r.decidedBy !== null && r.decidedBy !== 'total')
  return [
    { key: 'place', header: 'Place', cell: (r: SkatingRow) => (isPlacing ? ordinal(r.place) : r.place), widthClass: 'w-20', mono: true },
    { key: 'back', header: 'Back no.', cell: (r: SkatingRow) => r.backNumber ?? '–', mono: true },
    { key: 'who', header: 'Competitor', cell: (r: SkatingRow) => <span className="font-medium">{competitorName(r.names)}</span>, hideBelow: 'md' as const, detail: false as const },
    ...table.adjudicators.map((a) => ({
      key: `adj-${a.id}`,
      header: a.letter,
      cell: (r: SkatingRow) => r.marks[a.id] ?? '–',
      mono: true,
      align: 'right' as const,
      group: isPlacing ? 'Placings' : 'X marks',
    })),
    ...(isPlacing
      ? Array.from({ length: table.places }, (_, i) => ({
          key: `maj-${i + 1}`,
          header: placeRange(i + 1),
          cell: (r: SkatingRow) => <MajorityCell row={r} column={i + 1} />,
          mono: true,
          muted: true,
          align: 'right' as const,
          hideBelow: 'md' as const,
          group: 'Majority',
        }))
      : []),
    ...dances.map((d, i) => ({
      key: `dance-${d.dance}`,
      header: DANCE_LABEL[d.dance],
      cell: (r: SkatingRow) => r.dancePlaces[i]?.place ?? '',
      mono: true,
      align: 'right' as const,
      hideBelow: 'md' as const,
      group: 'Dance places',
    })),
    ...(!isPlacing || dances.length > 0
      ? [{
          key: 'total',
          header: isPlacing ? 'Total' : 'X',
          cell: (r: SkatingRow) => (isPlacing ? r.dancePlaces.reduce((sum, d) => sum + d.place, 0) : r.total),
          mono: true,
          bold: !isPlacing,
          align: 'right' as const,
        }]
      : []),
    ...(showRule
      ? [{ key: 'rule', header: 'Rule', cell: (r: SkatingRow) => (r.decidedBy ? RULE_LABEL[r.decidedBy] : ''), hideBelow: 'md' as const }]
      : []),
  ]
}
