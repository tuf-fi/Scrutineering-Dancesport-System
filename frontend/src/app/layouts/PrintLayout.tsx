import { Outlet } from 'react-router'

// No chrome: print pages are plain documents. A4 print CSS comes with the printouts.
export function PrintLayout() {
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 print:p-0">
      <Outlet />
    </div>
  )
}
