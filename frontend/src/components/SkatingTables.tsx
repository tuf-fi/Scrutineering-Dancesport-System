import type { SkatingRow, SkatingTable } from '@bis/shared'
import { competitorName, DANCE_LABEL } from '../lib/format.ts'
import { danceColumns, danceRows, isMultiDance, skatingColumns } from './skatingColumns.tsx'
import { Table } from './ui/index.ts'

const EMPTY = { title: 'No marks yet', description: 'The table fills in as adjudicators submit.' }

// One table, or with several dances one table per dance and then a summary
// ticks: whether the count where a place was decided is ticked; the public pages leave it off
export function SkatingTables({ table, variant, ticks = true }: { table: SkatingTable; variant?: 'plain'; ticks?: boolean }) {
  const common = {
    variant,
    dense: true,
    rowKey: (r: SkatingRow) => r.competitorId,
    minWidthClass: 'min-w-[36rem]',
    detailTitle: (r: SkatingRow) => competitorName(r.names),
    empty: EMPTY,
  }
  if (!isMultiDance(table)) {
    return <Table<SkatingRow> {...common} rows={table.rows} paginationLabel="Results pagination" columns={skatingColumns(table, ticks)} />
  }
  return (
    <div className="flex flex-col gap-8">
      {(table.rows[0]?.byDance ?? []).map((d, i) => (
        <section key={d.dance} aria-label={DANCE_LABEL[d.dance]} className="flex flex-col gap-3">
          <h3 className="text-small font-bold uppercase tracking-wide text-neutral-900">{DANCE_LABEL[d.dance]}</h3>
          <Table<SkatingRow> {...common} rows={danceRows(table, i)} paginationLabel={`${DANCE_LABEL[d.dance]} pagination`} columns={danceColumns(table, i, ticks)} />
        </section>
      ))}
      <section aria-label="Summary" className="flex flex-col gap-3">
        <h3 className="text-small font-bold uppercase tracking-wide text-neutral-900">Summary</h3>
        <Table<SkatingRow> {...common} rows={table.rows} paginationLabel="Summary pagination" columns={skatingColumns(table, ticks)} />
      </section>
    </div>
  )
}
