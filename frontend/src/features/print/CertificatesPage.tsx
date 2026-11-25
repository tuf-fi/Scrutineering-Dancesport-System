import { certificatePage, type CertificateLayout } from '@bis/shared'
import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCatalog, useCertificateLayout } from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances, ordinal, placeRange, sheetDate } from '../../lib/format.ts'
import { CertificateSheet } from './CertificateSheet.tsx'
import { certificateSignatures } from './certificateSignatures.ts'
import { PrintState } from './PrintState.tsx'
import { useFinalRows } from './useFinalRows.ts'
import { usePrintContext } from './usePrintContext.ts'
import { useSheetSigners } from './useSheetSigners.ts'

// On paper a certificate fills the whole sheet: no page margin and no border, so a background reaches the edges. It is a
// hair shorter than the paper, so rounding never pushes a thin strip of it onto another page.
function printCss(layout: CertificateLayout) {
  const { width, height } = certificatePage(layout)
  return `@page certificate { size: ${width}mm ${height}mm; margin: 0; }
/* The whole document is on the certificate page, so the empty elements after the certificates cannot start a page of their own */
body { page: certificate; }
@media print {
  .certificate-page { width: ${width}mm !important; height: ${height - 0.3}mm !important; max-width: none !important; border: 0 !important; box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`
}

// One certificate for each placed finalist of an approved final, one to a page, signed by the scrutineer and the chairperson
export function CertificatesPage() {
  const { eventId = '' } = useParams()
  const signers = useSheetSigners(eventId)
  const ctx = usePrintContext(eventId)
  const { rows: placed, byId, failed, retry } = useFinalRows(eventId)
  // Last place prints first and 1st last, so the pile is in order when it is handed out from the top
  const rows = [...placed].sort((a, b) => b.place - a.place)
  const { eventGrade } = useCatalog()
  const layout = useCertificateLayout()

  return (
    <PrintState ctx={ctx} failed={failed || layout.isError} onRetry={retry}>
      {({ event, competition }) => {
        if (rows.length === 0) {
          return <EmptyState title="No certificates yet" description="They appear here once the scrutineer has approved the final." />
        }
        if (!layout.data) return null
        const date = sheetDate(competition.date)
        return (
          <>
            <style>{printCss(layout.data)}</style>
            <div className="certificate-pages flex flex-col gap-8 pb-8 print:block print:pb-0">
              {rows.map((r, i) => {
                const c = byId.get(r.competitorId)
                const name = c ? competitorName(c.names) : ''
                return (
                  <CertificateSheet
                    key={r.id}
                    layout={layout.data}
                    signatures={certificateSignatures(layout.data, competition.organizer, signers.chairperson)}
                    date={date}
                    label={`Certificate, ${name}`}
                    pageBreak={i < rows.length - 1}
                    values={{
                      organizer: competition.organizer,
                      competition: competition.name,
                      // Each athlete on a line of their own
                      name: c ? c.names.join(String.fromCharCode(10)) : '',
                      team: c?.teamName ?? '',
                      place: placeRange(r) ?? ordinal(r.place),
                      event: `${eventCode(event)} ${eventDances(event)}`,
                      grade: eventGrade(event),
                      number: typeof c?.backNumber === 'number' ? String(c.backNumber) : '',
                      venue: competition.venue,
                      date,
                    }}
                  />
                )
              })}
            </div>
          </>
        )
      }}
    </PrintState>
  )
}
