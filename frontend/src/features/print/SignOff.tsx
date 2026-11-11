import { Input } from '../../components/ui/index.ts'
import { SignaturePad } from '../adjudicator/SignaturePad.tsx'

export interface Signer {
  name: string
  signature: string | null
}

export const SIGNERS = [
  { key: 'scrutineer', role: 'Scrutineer' },
  { key: 'chairperson', role: 'Chairperson of Adjudicators' },
] as const

export type SignerKey = (typeof SIGNERS)[number]['key']
export type Signers = Record<SignerKey, Signer>

// On screen only: the scrutineer and the chairperson put their name and signature here before the sheet is printed
export function SignOff({ signers, onChange }: { signers: Signers; onChange: (key: SignerKey, next: Signer) => void }) {
  return (
    <section aria-label="Sign before printing" className="print:hidden mb-8 flex flex-col gap-4 rounded-lg border border-neutral-200 p-4">
      <div>
        <h2 className="text-small font-bold uppercase tracking-wide text-neutral-900">Sign before printing</h2>
        <p className="text-small text-neutral-600">Each signs in the box. The name and date print on the sheet with the signature.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {SIGNERS.map(({ key, role }) => (
          <div key={key} className="flex flex-col gap-3">
            <Input label={`${role}, name`} value={signers[key].name} onChange={(e) => onChange(key, { ...signers[key], name: e.target.value })} />
            <SignaturePad onChange={(signature) => onChange(key, { ...signers[key], signature })} />
          </div>
        ))}
      </div>
    </section>
  )
}
