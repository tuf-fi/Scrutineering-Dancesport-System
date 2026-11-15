import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCatalog } from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances, ordinal, placeRange, sheetDate } from '../../lib/format.ts'
import { PrintState } from './PrintState.tsx'
import { SignLine } from './SignLine.tsx'
import { SIGNERS } from './signers.ts'
import { useFinalRows } from './useFinalRows.ts'
import { usePrintContext } from './usePrintContext.ts'
import { useSheetSigners } from './useSheetSigners.ts'

// One certificate for each placed finalist of an approved final, one to a page, signed by the scrutineer and the chairperson
export function CertificatesPage() {
  const { eventId = '' } = useParams()
  const signers = useSheetSigners(eventId)
  const ctx = usePrintContext(eventId)
  const { rows, byId, failed, retry } = useFinalRows(eventId)
  const { eventGrade } = useCatalog()

  return (
    <PrintState ctx={ctx} failed={failed} onRetry={retry}>
      {({ event, competition }) => {
        if (rows.length === 0) {
          return <EmptyState title="No certificates yet" description="They appear here once the scrutineer has approved the final." />
        }
        const date = sheetDate(competition.date)
        return (
          <>
            <div className="flex flex-col gap-8 print:gap-0">
              {rows.map((r, i) => {
                const c = byId.get(r.competitorId)
                return (
                  <article
                    key={r.id}
                    aria-label={`Certificate, ${c ? competitorName(c.names) : ''}`}
                    className={`certificate-page flex h-[184mm] flex-col justify-between border border-neutral-900 px-[16mm] py-[9mm] text-neutral-900 ${i < rows.length - 1 ? 'print-page-break' : ''}`}
                  >
                    <header className="flex flex-col items-center gap-2 text-center">
                      <p className="text-[10pt] font-bold uppercase tracking-[0.2em]">{competition.organizer}</p>
                      <h1 className="text-[26pt] font-bold leading-tight">Certificate</h1>
                      <p className="text-[11pt]">{competition.name}</p>
                    </header>

                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="text-[12pt]">This is to certify that</p>
                      <p className="text-[24pt] font-bold uppercase leading-tight">{c ? competitorName(c.names) : ''}</p>
                      {c?.teamName && <p className="text-[13pt]">{c.teamName}</p>}
                      <p className="text-[12pt]">placed</p>
                      <p className="text-[30pt] font-bold leading-none">{placeRange(r) ?? ordinal(r.place)}</p>
                      <p className="text-[13pt]">
                        in <span className="font-bold">{eventCode(event)} {eventDances(event)}</span>
                      </p>
                      <p className="text-[11pt]">{eventGrade(event)}</p>
                      {typeof c?.backNumber === 'number' && <p className="font-mono text-[10pt]">No. {c.backNumber}</p>}
                    </div>

                    <footer className="flex flex-col gap-4">
                      <p className="text-center text-[10pt]">
                        {competition.venue}, {date}
                      </p>
                      <div className="grid grid-cols-2 gap-24">
                        {SIGNERS.map(({ key, role }) => (
                          <SignLine key={key} role={role} signer={signers[key]} date={date} center />
                        ))}
                      </div>
                      <p className="text-center text-[8pt] uppercase tracking-[0.2em] text-neutral-500">This is a placeholder certificate</p>
                    </footer>
                  </article>
                )
              })}
            </div>
          </>
        )
      }}
    </PrintState>
  )
}
