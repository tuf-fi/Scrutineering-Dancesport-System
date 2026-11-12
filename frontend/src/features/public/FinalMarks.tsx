import type { SkatingRow } from '@bis/shared'
import { skatingColumns } from '../../components/skatingColumns.tsx'
import { ErrorState, SkeletonList, Table } from '../../components/ui/index.ts'
import { useSkatingTable } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'

// A published final's marks, with a tick where each place was decided, so competitors can follow the working
export function FinalMarks({ roundId }: { roundId: string }) {
  const table = useSkatingTable(roundId)
  if (table.isError) return <ErrorState onRetry={() => void table.refetch()} />

  return (
    <section aria-labelledby="marks" className="flex flex-col gap-4">
      <h2 id="marks" className="text-small font-bold uppercase tracking-wide text-neutral-900">
        Adjudicators’ marks
      </h2>
      {!table.data ? (
        <SkeletonList rows={5} />
      ) : (
        <Table<SkatingRow>
          rows={table.data.rows}
          rowKey={(r) => r.competitorId}
          minWidthClass="min-w-[36rem]"
          paginationLabel="Marks pagination"
          detailTitle={(r) => competitorName(r.names)}
          empty={{ title: 'No marks yet', description: 'The marks appear once the results are published.' }}
          columns={skatingColumns(table.data)}
        />
      )}
    </section>
  )
}
