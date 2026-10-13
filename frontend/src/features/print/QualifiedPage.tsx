import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCompetitorRows, useRecallTable } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, competitorName } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

// "Qualified Solos for the final": who goes through, sorted by back number, like the paper sheet
export function QualifiedPage() {
  const { eventId = '' } = useParams()
  const ctx = usePrintContext(eventId)
  const hasRecall = ctx.round?.recallNumber != null
  const recall = useRecallTable(ctx.round?.id ?? '', hasRecall)
  const people = useCompetitorRows()

  return (
    <PrintState ctx={ctx} failed={recall.isError || people.isError} onRetry={() => void Promise.all([recall.refetch(), people.refetch()])}>
      {({ event, competition, round, next, adjudicators }) => {
        if (!round || round.recallNumber === null) {
          return <EmptyState title="A final has no recall list" description="Print the final results instead." />
        }
        const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
        const through = (recall.data?.rows ?? [])
          .filter((r) => r.outcome === 'recalled')
          .sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0))
        const noun = event.isSolo ? 'Solos' : 'Couples'
        const target = next ? ROUND_TYPE_LABEL[next.type].toLowerCase() : 'next round'
        return (
          <PrintSheet
            title={`Qualified ${noun} for the ${target}`}
            event={event}
            competition={competition}
            adjudicators={adjudicators}
            footer={
              <>
                {through.length} {noun}. (Total: {recall.data?.rows.length ?? 0} {noun})
                {recall.data?.tie && !recall.data.tie.decision?.confirmedBy && (
                  <span className="mt-1 block font-normal">The tie at the cutoff is not confirmed yet.</span>
                )}
              </>
            }
          >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>No.</th>
                  <th className={th}>{event.isSolo ? 'Solo' : 'Couple'}:</th>
                  <th className={th}>Country:</th>
                </tr>
              </thead>
              <tbody>
                {through.map((r) => (
                  <tr key={r.competitorId}>
                    <td className={`${td} ${num}`}>{r.backNumber}</td>
                    <td className={td}>{competitorName(r.names)}</td>
                    <td className={td}>{byId.get(r.competitorId)?.clubName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSheet>
        )
      }}
    </PrintState>
  )
}
