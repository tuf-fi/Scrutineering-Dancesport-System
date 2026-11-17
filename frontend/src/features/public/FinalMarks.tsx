import { SkatingTables } from '../../components/SkatingTables.tsx'
import { ErrorState, SkeletonList } from '../../components/ui/index.ts'
import { useSkatingTable } from '../../hooks/index.ts'

// A published final's marks, with a tick where each place was decided, so competitors can follow the working
export function FinalMarks({ roundId }: { roundId: string }) {
  const table = useSkatingTable(roundId)
  if (table.isError) return <ErrorState onRetry={() => void table.refetch()} />

  return (
    <section aria-labelledby="marks" className="flex flex-col gap-3">
      <h3 id="marks" className="text-small font-bold uppercase tracking-wide text-neutral-900">
        Skating System working
      </h3>
      {!table.data ? (
        <SkeletonList rows={5} />
      ) : (
        <SkatingTables table={table.data} variant="plain" />
      )}
    </section>
  )
}
