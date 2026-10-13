import { useParams } from 'react-router'
import { useCompetitorRows, useHeatAssignments } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, competitorName } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

// Who dances in which heat of a round, for the floor manager and the notice board
export function HeatListPage() {
  const { eventId = '' } = useParams()
  const ctx = usePrintContext(eventId)
  const assignments = useHeatAssignments(ctx.round?.id ?? '')
  const people = useCompetitorRows()

  return (
    <PrintState ctx={ctx} failed={assignments.isError || people.isError} onRetry={() => void Promise.all([assignments.refetch(), people.refetch()])}>
      {({ event, competition, round, adjudicators }) => {
        const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
        const heats = [...new Set((assignments.data ?? []).map((a) => a.heat))].sort((a, b) => a - b)
        return (
          <PrintSheet
            title={`Heat list: ${round ? ROUND_TYPE_LABEL[round.type] : ''}`}
            event={event}
            competition={competition}
            adjudicators={adjudicators}
            footer={`${assignments.data?.length ?? 0} ${event.isSolo ? 'Solos' : 'Couples'} in ${heats.length} heat${heats.length === 1 ? '' : 's'}.`}
          >
            <div className="flex flex-col gap-5">
              {heats.map((heat) => (
                <section key={heat} className="break-inside-avoid">
                  <h2 className="mb-1 font-bold">Heat {heat}</h2>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${th} w-16`}>No.</th>
                        <th className={th}>{event.isSolo ? 'Solo' : 'Couple'}</th>
                        <th className={th}>Club</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(assignments.data ?? [])
                        .filter((a) => a.heat === heat)
                        .map((a) => byId.get(a.competitorId))
                        .sort((a, b) => (a?.backNumber ?? 0) - (b?.backNumber ?? 0))
                        .map((c) => (
                          <tr key={c?.id}>
                            <td className={`${td} ${num}`}>{c?.backNumber}</td>
                            <td className={td}>{c ? competitorName(c.names) : ''}</td>
                            <td className={td}>{c?.clubName}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          </PrintSheet>
        )
      }}
    </PrintState>
  )
}
