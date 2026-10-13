import { Outlet, useNavigate } from 'react-router'
import { Button } from '../../components/ui/index.ts'

// Print pages are plain documents. On screen a slim bar offers Print; on paper only the sheet shows.
export function PrintLayout() {
  const navigate = useNavigate()

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
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-6 shadow-sm sm:p-[12mm] print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <Outlet />
      </div>
    </div>
  )
}
