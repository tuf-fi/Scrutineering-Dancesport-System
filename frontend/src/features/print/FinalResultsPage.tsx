import { EmptyState } from '../../components/ui/index.ts'
import { useParams } from 'react-router'
import { competitorName, ordinal, placeRange, sheetDate, todayIso } from '../../lib/format.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { SignLine } from './SignLine.tsx'
import { SIGNERS } from './signers.ts'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { useFinalRows } from './useFinalRows.ts'
import { usePrintContext } from './usePrintContext.ts'
import { useSheetSigners } from './useSheetSigners.ts'

// The final placings, signed by the scrutineer and the chairperson from the signatures saved on their accounts; the date is today's
export function FinalResultsPage() {
  const { eventId = '' } = useParams()
  const signers = useSheetSigners(eventId)
  const date = sheetDate(todayIso())
  const ctx = usePrintContext(eventId)
  const { rows, byId, failed, retry } = useFinalRows(eventId)

  return (
    <PrintState ctx={ctx} failed={failed} onRetry={retry}>
      {({ event, competition, adjudicators }) => {
        if (rows.length === 0) {
          return <EmptyState title="No final results yet" description="They appear here once the scrutineer has approved the final." />
        }
        return (
          <>
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
                    <th className={th}>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = byId.get(r.competitorId)
                    return (
                      <tr key={r.id}>
                        <td className={`${td} font-bold`}>
                          {placeRange(r) ?? ordinal(r.place)}
                        </td>
                        <td className={`${td} ${num}`}>{c?.backNumber}</td>
                        <td className={td}>{c ? competitorName(c.names) : ''}</td>
                        <td className={td}>{c?.teamName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-12 break-inside-avoid">
                {SIGNERS.map(({ key, role }) => (
                  <SignLine key={key} role={role} signer={signers[key]} date={date} />
                ))}
              </div>
            </div>
          </PrintSheet>
          </>
        )
      }}
    </PrintState>
  )
}
