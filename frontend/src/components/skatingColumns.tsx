import type { SkatingRow, SkatingTable } from '@bis/shared'
import type { ReactNode } from 'react'
import { MajorityCell } from './MajorityCell.tsx'
import type { Column as TableColumn } from './ui/Table.tsx'
import { DANCE_LABEL, competitorName, ordinal } from '../lib/format.ts'

const placeRange = (k: number) => (k === 1 ? '1' : `1–${k}`)

const RULE_LABEL: Record<NonNullable<SkatingRow['decidedBy']>, string> = {
  total: '',
  rule10: 'Rule 10',
  rule11: 'Rule 11',
  shared: 'Shared',
}

// The 1, 1-2, 1-3 ... columns of the Skating System working
const majorityColumns = (count: number, counts: (r: SkatingRow) => number[], tick: (r: SkatingRow) => number | null): Column[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `maj-${i + 1}`,
    header: placeRange(i + 1),
    cell: (r) => <MajorityCell counts={counts(r)} tick={tick(r)} column={i + 1} />,
    mono: true,
    muted: true,
    align: 'center',
    hideBelow: 'md',
    group: 'Majority',
  }))

type Column = TableColumn<SkatingRow>

const placeColumn = (cell: (r: SkatingRow) => ReactNode): Column => ({ key: 'place', header: 'Place', cell, widthClass: 'w-20', mono: true })
const backColumn: Column = { key: 'back', header: 'Back no.', cell: (r) => r.backNumber ?? '–', mono: true }
const whoColumn: Column = { key: 'who', header: 'Competitor', cell: (r) => <span className="font-medium">{competitorName(r.names)}</span>, hideBelow: 'md', detail: false }

// More than one dance: one table per dance, then a summary table
export const isMultiDance = (table: SkatingTable) => (table.rows[0]?.byDance.length ?? 0) > 1

const sumOf = (marks: Record<string, number | null>) => Object.values(marks).reduce<number>((sum, v) => sum + (v ?? 0), 0)

// The competitors in one dance, best first
export function danceRows(table: SkatingTable, index: number): SkatingRow[] {
  const mine = (r: SkatingRow) => r.byDance[index]
  return [...table.rows].sort((a, b) =>
    table.kind === 'placing'
      ? (mine(a)?.place ?? 0) - (mine(b)?.place ?? 0)
      : sumOf(mine(b)?.marks ?? {}) - sumOf(mine(a)?.marks ?? {}) || (a.backNumber ?? 0) - (b.backNumber ?? 0),
  )
}

// One dance's own marks from each adjudicator
export function danceColumns(table: SkatingTable, index: number, ticks = true): Column[] {
  const isPlacing = table.kind === 'placing'
  return [
    backColumn,
    whoColumn,
    ...table.adjudicators.map((a) => ({
      key: `adj-${a.id}`,
      header: a.letter,
      cell: (r: SkatingRow) => r.byDance[index]?.marks[a.id] ?? '–',
      mono: true,
      align: 'center' as const,
      group: isPlacing ? 'Placings' : 'X marks',
    })),
    ...(isPlacing ? majorityColumns(table.rows.length, (r) => r.byDance[index]?.majority ?? [], (r) => (ticks ? (r.byDance[index]?.placedColumn ?? null) : null)) : []),
    ...(isPlacing ? [{ key: 'result', header: 'Dance result', cell: (r: SkatingRow) => ordinal(r.byDance[index]?.place ?? 0), mono: true, bold: true, align: 'center' as const }] : []),
    ...(isPlacing ? [] : [{ key: 'x', header: 'X', cell: (r: SkatingRow) => sumOf(r.byDance[index]?.marks ?? {}), mono: true, bold: true, align: 'center' as const }]),
  ]
}

export function skatingColumns(table: SkatingTable, ticks = true): Column[] {
  const isPlacing = table.kind === 'placing'
  const dances = table.rows[0]?.dancePlaces ?? []
  const many = isMultiDance(table)
  const showRule = table.rows.some((r) => r.decidedBy !== null && r.decidedBy !== 'total')
  const rule: Column[] = showRule
    ? [{ key: 'rule', header: 'Rule', cell: (r) => (r.decidedBy ? RULE_LABEL[r.decidedBy] : ''), hideBelow: 'md' }]
    : []
  const place = placeColumn((r) => (isPlacing ? ordinal(r.place) : r.place))

  if (many) {
    return [
      backColumn,
      whoColumn,
      ...(table.rows[0]?.byDance ?? []).map((d, i) => ({
        key: `dance-${d.dance}`,
        header: DANCE_LABEL[d.dance],
        cell: (r: SkatingRow) => (isPlacing ? (r.byDance[i]?.place ?? '') : sumOf(r.byDance[i]?.marks ?? {})),
        mono: true,
        align: 'center' as const,
        group: isPlacing ? 'Dance places' : 'X marks per dance',
      })),
      { key: 'total', header: isPlacing ? 'Total' : 'X', cell: (r) => (isPlacing ? r.dancePlaces.reduce((sum, d) => sum + d.place, 0) : r.total), mono: true, bold: !isPlacing, align: 'center' },
      { key: 'final', header: isPlacing ? 'Final rank' : 'Rank', cell: (r) => (isPlacing ? ordinal(r.place) : r.place), mono: true, bold: true, align: 'center' },
      ...rule,
    ]
  }

  return [
    place,
    backColumn,
    whoColumn,
    ...table.adjudicators.map((a) => ({
      key: `adj-${a.id}`,
      header: a.letter,
      cell: (r: SkatingRow) => r.marks[a.id] ?? '–',
      mono: true,
      align: 'center' as const,
      group: isPlacing ? 'Placings' : 'X marks',
    })),
    ...(isPlacing ? majorityColumns(table.places, (r) => r.majority, (r) => (ticks ? r.placedColumn : null)) : []),
    ...(dances.length > 0
      ? [{ key: 'total', header: 'Total', cell: (r: SkatingRow) => r.dancePlaces.reduce((sum, d) => sum + d.place, 0), mono: true, align: 'center' as const }]
      : []),
    ...(!isPlacing ? [{ key: 'total', header: 'X', cell: (r: SkatingRow) => r.total, mono: true, bold: true, align: 'center' as const }] : []),
    ...rule,
  ]
}
