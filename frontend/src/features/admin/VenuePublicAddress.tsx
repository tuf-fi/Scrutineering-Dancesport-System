import { QrCode } from '../../components/QrCode.tsx'
import { Button } from '../../components/ui/index.ts'

// Visitors join the venue Wi-Fi and scan this to open the public pages from the laptop
export function VenuePublicAddress() {
  const address = `${window.location.origin}/`
  return (
    <section aria-label="Public site for visitors" className="flex flex-wrap items-center gap-6 rounded-lg border border-neutral-200 bg-white p-5">
      <QrCode value={address} label="QR code for the public site" size={144} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="text-small font-bold uppercase tracking-wide text-neutral-900">Public site for visitors</h2>
        <p className="text-small text-neutral-600">Visitors join the venue Wi-Fi, then scan this code or type the address to see the program and results.</p>
        <p className="break-all font-mono text-body text-neutral-900">{address}</p>
        <div>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
    </section>
  )
}
