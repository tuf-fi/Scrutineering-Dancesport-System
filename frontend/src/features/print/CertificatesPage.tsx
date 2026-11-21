import { certificatePage } from '@bis/shared'
import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCatalog, useCertificateLayout } from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances, ordinal, placeRange, sheetDate } from '../../lib/format.ts'
import { CertificateSheet, certificateSignatures } from './CertificateSheet.tsx'
import { PrintState } from './PrintState.tsx'
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
            <style>{`@page certificate { size: ${certificatePage(layout.data).width}mm ${certificatePage(layout.data).height}mm; margin: 12mm; }`}</style>
            <div className="flex flex-col gap-8 print:gap-0">
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
                      name,
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
