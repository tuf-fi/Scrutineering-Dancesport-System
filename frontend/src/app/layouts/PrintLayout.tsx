import { certificatePage } from '@bis/shared'
import { Outlet, useMatch, useNavigate } from 'react-router'
import { Button } from '../../components/ui/index.ts'
import { useCertificateLayout } from '../../hooks/index.ts'

// Print pages are plain documents. On screen a slim bar offers Print; on paper only the sheet shows.
export function PrintLayout() {
  const navigate = useNavigate()
  // A certificate's sheet is as wide as its paper, in the size and direction the layout says
  const certificates = useMatch('/print/certificates/:eventId') !== null
  const layout = useCertificateLayout(certificates)
  const paperWidth = certificates && layout.data ? certificatePage(layout.data).width : 210

  return (
    <div className="min-h-dvh bg-neutral-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div style={{ maxWidth: `${paperWidth}mm` }} className={`mx-auto my-6 bg-white p-6 shadow-sm sm:p-[12mm] print:my-0 print:max-w-none print:p-0 print:shadow-none`}>
        <Outlet />
      </div>
    </div>
  )
}
