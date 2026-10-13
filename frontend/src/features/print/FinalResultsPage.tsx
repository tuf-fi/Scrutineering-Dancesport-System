import { RoundType } from '@bis/shared'
import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCompetitorRows, useResults, useRounds, useSkatingTable } from '../../hooks/index.ts'
import { competitorName, ordinal } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

function SignLine({ role }: { role: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-12 border-b border-neutral-900" />
      <p className="font-semibold">{role}</p>
      <p className="text-[9pt]">Name and signature</p>
      <div className="mt-3 h-6 border-b border-neutral-900" />
      <p className="text-[9pt]">Date</p>
    </div>
  )
}

// The final placings with room for the scrutineer and the chairperson to sign
export function FinalResultsPage() {
  const { eventId = '' } = useParams()
  const ctx = usePrintContext(eventId)
  const rounds = useRounds(eventId)
  const final = rounds.data?.find((r) => r.type === RoundType.Final)
  const results = useResults(eventId)
  const finalTable = useSkatingTable(final?.id ?? '')
  const people = useCompetitorRows()

  return (
    <PrintState ctx={ctx} failed={results.isError || finalTable.isError || people.isError} onRetry={() => void Promise.all([results.refetch(), finalTable.refetch(), people.refetch()])}>
      {({ event, competition, adjudicators }) => {
        const finalists = new Set((finalTable.data?.rows ?? []).map((r) => r.competitorId))
        const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
        const rows = (results.data ?? [])
          .filter((r) => finalists.has(r.competitorId))
          .sort((a, b) => a.place - b.place)
        if (rows.length === 0) {
          return <EmptyState title="No final results yet" description="They appear here once the scrutineer has approved the final." />
        }
        return (
          <PrintSheet
            title="Final results"
            event={event}
            competition={competition}
            adjudicators={adjudicators}
            footer={`${rows.length} ${event.isSolo ? 'Solos' : 'Couples'} in the final.`}
          >
            <div className="flex flex-col gap-10">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-20`}>Place</th>
                    <th className={`${th} w-16`}>No.</th>
                    <th className={th}>{event.isSolo ? 'Solo' : 'Couple'}</th>
                    <th className={th}>Club</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = byId.get(r.competitorId)
                    return (
                      <tr key={r.id}>
                        <td className={`${td} font-bold`}>{ordinal(r.place)}</td>
                        <td className={`${td} ${num}`}>{c?.backNumber}</td>
                        <td className={td}>{c ? competitorName(c.names) : ''}</td>
                        <td className={td}>{c?.clubName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-12 break-inside-avoid">
                <SignLine role="Scrutineer" />
                <SignLine role="Chairperson of Adjudicators" />
              </div>
            </div>
          </PrintSheet>
        )
      }}
    </PrintState>
  )
}
