import { useParams } from 'react-router'
import { useCompetitorRows, useHeatAssignments } from '../../hooks/index.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, ordinal } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

const box = 'inline-block size-5 border border-neutral-900 align-middle'

// Paper fallback: one blank mark sheet per adjudicator on the panel, with the round's numbers filled in
export function BlankSheetsPage() {
  const { eventId = '' } = useParams()
  const ctx = usePrintContext(eventId)
  const assignments = useHeatAssignments(ctx.round?.id ?? '')
  const people = useCompetitorRows()

  return (
    <PrintState ctx={ctx} failed={assignments.isError || people.isError} onRetry={() => void Promise.all([assignments.refetch(), people.refetch()])}>
      {({ event, competition, round, adjudicators }) => {
        const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
        const numbers = (assignments.data ?? [])
          .map((a) => byId.get(a.competitorId)?.backNumber)
          .filter((n): n is number => typeof n === 'number')
          .sort((a, b) => a - b)
        const isFinal = !round || round.recallNumber === null
        const finalists = numbers.length

        return (
          <div className="flex flex-col">
            {adjudicators.map((a, i) => (
              <div key={a.id} className={i < adjudicators.length - 1 ? 'print-page-break pb-8' : ''}>
                <PrintSheet
                  title={`Adjudicator mark sheet: ${round ? ROUND_TYPE_LABEL[round.type] : ''}`}
                  event={event}
                  competition={competition}
                  footer={
                    isFinal
                      ? `Write each competitor's number once per place, 1st to ${ordinal(finalists)}.`
                      : `Mark an X for exactly ${round?.recallNumber} competitors in each dance.`
                  }
                >
                  <div className="mb-4 grid grid-cols-[auto_1fr] items-end gap-x-3 gap-y-3">
                    <span className="font-bold">Adjudicator</span>
                    <span className="text-[16pt] font-bold leading-none">{a.letter}</span>
                    <span>Name</span>
                    <span className="border-b border-neutral-900" />
                    <span>Signature</span>
                    <span className="border-b border-neutral-900" />
                  </div>

                  {isFinal ? (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${th} w-24`}>Place</th>
                          {event.dances.map((d) => (
                            <th key={d} className={`${th} text-center`}>
                              {DANCE_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: finalists }, (_, p) => (
                          <tr key={p} className="h-9">
                            <td className={`${td} font-bold`}>{ordinal(p + 1)}</td>
                            {event.dances.map((d) => (
                              <td key={d} className={`${td} text-center`}>
                                <span className="inline-block h-6 w-20 border-b border-neutral-900" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${th} w-20`}>No.</th>
                          {event.dances.map((d) => (
                            <th key={d} className={`${th} text-center`}>
                              {DANCE_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {numbers.map((n) => (
                          <tr key={n} className="h-8">
                            <td className={`${td} ${num} font-semibold`}>{n}</td>
                            {event.dances.map((d) => (
                              <td key={d} className={`${td} text-center`}>
                                <span className={box} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </PrintSheet>
              </div>
            ))}
          </div>
        )
      }}
    </PrintState>
  )
}
