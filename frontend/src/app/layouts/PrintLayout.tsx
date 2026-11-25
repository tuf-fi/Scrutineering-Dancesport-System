import { certificatePage } from '@bis/shared'
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { Button, toast } from '../../components/ui/index.ts'
import { useCertificateLayout } from '../../hooks/index.ts'
import { downloadPdf } from '../../lib/pdf.ts'

// A dashed line every A4 page (297 mm less the 12 mm margin at top and bottom), under the content and never printed
function PageGuides() {
  return (
    <div
      aria-hidden
      data-pdf-skip
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[12mm] hidden sm:block print:hidden"
      style={{
        backgroundImage: 'linear-gradient(to bottom, transparent calc(273mm - 1px), #cfcac5 calc(273mm - 1px))',
        backgroundSize: '100% 273mm',
        backgroundRepeat: 'repeat-y',
        maskImage: 'repeating-linear-gradient(to right, #000 0 6px, transparent 6px 12px)',
      }}
    />
  )
}

// Print pages are plain documents. On screen a slim bar offers Print; on paper only the sheet shows.
export function PrintLayout() {
  const navigate = useNavigate()
  // A certificate's sheet is as wide as its paper, in the size and direction the layout says
  const certificates = useMatch('/print/certificates/:eventId') !== null
  const layout = useCertificateLayout(certificates)
  const paper = certificates && layout.data ? certificatePage(layout.data) : { width: 210, height: 297 }
  // These printouts are made of whole pages, each drawn as a sheet of its own. The rest flow over as many A4 pages as they need,
  // so a dashed line shows about where the printer starts a new page.
  const blankSheets = useMatch('/print/blank-sheets/:eventId') !== null
  const eventList = useMatch('/print/event-list/:competitionId') !== null
  const paged = certificates || blankSheets || eventList
  const sheet = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const { pathname } = useLocation()

  // The printout as a PDF file, named after what it is: /print/heats/E1 is "heats", the program is "program"
  async function save() {
    if (!sheet.current) return
    const parts = pathname.split('/').filter(Boolean)
    const name = parts.includes('program') ? 'program' : (parts[0] === 'print' ? parts[1] : parts[0]) || 'printout'
    setSaving(true)
    try {
      await downloadPdf(sheet.current, name, paper)
    } catch {
      toast.error('The PDF could not be made. Try Print and choose Save as PDF instead.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-100 print:min-h-0 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => void save()}>
            <Download aria-hidden size={16} strokeWidth={2} />
            {saving ? 'Preparing…' : 'Download PDF'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      <div ref={sheet} style={{ maxWidth: `${paper.width}mm` }} className={`relative mx-auto my-6 ${paged ? '' : 'bg-white p-6 shadow-sm sm:p-[12mm]'} print:my-0 print:max-w-none print:p-0 print:shadow-none`}>
        <Outlet />
        {!paged && <PageGuides />}
      </div>
    </div>
  )
}
