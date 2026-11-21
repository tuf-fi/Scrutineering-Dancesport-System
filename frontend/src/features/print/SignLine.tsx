import type { CSSProperties, HTMLAttributes } from 'react'
import type { Signer } from './signers.ts'

// What the certificate editor adds to the signature picture and the name so each can be dragged on its own
export interface SignParts {
  signature?: HTMLAttributes<HTMLElement> & { style?: CSSProperties }
  name?: HTMLAttributes<HTMLElement> & { style?: CSSProperties }
}

// A signature line on a printed sheet: the signature above the rule, then the role, the name and the date, all centered
export function SignLine({ role, signer, date, center = true, plain = false, parts }: { role: string; signer: Signer; date: string; center?: boolean; plain?: boolean; parts?: SignParts }) {
  return (
    <div className={`flex flex-col gap-1 ${center ? 'text-center' : ''}`}>
      {/* On a certificate the printed name sits on the rule, under the signature picture */}
      <div className={`flex items-center justify-end border-b border-neutral-900 ${plain ? 'min-h-[4.5rem] flex-col' : 'h-12 items-end'} ${!plain && center ? 'justify-center' : ''}`}>
        {signer.signature && <img src={signer.signature} alt={`Signature of the ${role}`} {...parts?.signature} className={`max-h-12 ${parts?.signature?.className ?? ''}`} draggable={false} />}
        {plain && signer.name.trim() && (
          <p {...parts?.name} className={parts?.name?.className}>
            {signer.name.trim()}
          </p>
        )}
      </div>
      <p className="font-semibold">{role}</p>
      <p className="text-[9pt]">{plain ? 'Name and Signature' : `Name and signature${signer.name.trim() ? `: ${signer.name.trim()}` : ''}`}</p>
      <div className={`mt-3 flex h-6 items-end border-b border-neutral-900 ${center ? 'justify-center' : ''}`}>{date}</div>
      <p className="text-[9pt]">Date</p>
    </div>
  )
}
