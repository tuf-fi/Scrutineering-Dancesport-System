import type { Signer } from './signers.ts'

// A signature line on a printed sheet: the signature above the rule, then the role, the name and the date, all centered
export function SignLine({ role, signer, date, center = true, plain = false }: { role: string; signer: Signer; date: string; center?: boolean; plain?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${center ? 'text-center' : ''}`}>
      <div className={`flex h-12 items-end border-b border-neutral-900 ${center ? 'justify-center' : ''}`}>
        {signer.signature && <img src={signer.signature} alt={`Signature of the ${role}`} className="max-h-12" />}
      </div>
      {plain && signer.name.trim() && <p className="font-semibold">{signer.name.trim()}</p>}
      <p className={plain && signer.name.trim() ? '' : 'font-semibold'}>{role}</p>
      <p className="text-[9pt]">{plain ? 'Name and Signature' : `Name and signature${signer.name.trim() ? `: ${signer.name.trim()}` : ''}`}</p>
      <div className={`mt-3 flex h-6 items-end border-b border-neutral-900 ${center ? 'justify-center' : ''}`}>{date}</div>
      <p className="text-[9pt]">Date</p>
    </div>
  )
}
