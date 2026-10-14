import { useParams } from 'react-router'
import { useSkatingTable } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, competitorName, ordinal } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

// Every adjudicator's marks for a round, one row per competitor
export function ScoresPage() {
  const { eventId = '' } = useParams()
  const ctx = usePrintContext(eventId)
  const table = useSkatingTable(ctx.round?.id ?? '')

  return (
    <PrintState ctx={ctx} failed={table.isError} onRetry={() => void table.refetch()}>
      {({ event, competition, round, adjudicators }) => {
        const data = table.data
        const placing = data?.kind === 'placing'
        return (
          <PrintSheet
            title={`Scores sheet: ${round ? ROUND_TYPE_LABEL[round.type] : ''}`}
            event={event}
            competition={competition}
            adjudicators={adjudicators}
            footer={
              placing ? 'Placings are 1 for best. A shared place is read at its best place.' : 'An X is 1; the total is the number of X marks.'
            }
          >
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr>
                  <th className={th}>Place</th>
                  <th className={th}>No.</th>
                  <th className={th}>{event.isSolo ? 'Solo' : 'Couple'}</th>
                  {data?.adjudicators.map((a) => (
                    <th key={a.id} className={`${th} text-right`}>
                      {a.letter}
                    </th>
                  ))}
                  {placing &&
                    Array.from({ length: data?.places ?? 0 }, (_, i) => (
                      <th key={i} className={`${th} text-right font-normal`}>
                        {i === 0 ? '1' : `1-${i + 1}`}
                      </th>
                    ))}
                  <th className={`${th} text-right`}>{placing ? 'Total' : 'X'}</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.competitorId}>
                    <td className={`${td} ${num}`}>{placing ? ordinal(r.place) : r.place}</td>
                    <td className={`${td} ${num}`}>{r.backNumber}</td>
                    <td className={td}>{competitorName(r.names)}</td>
                    {data.adjudicators.map((a) => (
                      <td key={a.id} className={`${td} ${num} text-right`}>
                        {r.marks[a.id] ?? ''}
                      </td>
                    ))}
                    {placing && r.majority.map((m, i) => <td key={i} className={`${td} ${num} text-right`}>{m}</td>)}
                    <td className={`${td} ${num} text-right font-bold`}>{r.total}</td>
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
