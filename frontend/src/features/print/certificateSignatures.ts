import type { CertificateLayout } from '@bis/shared'
import type { Signer } from './signers.ts'

export interface CertificateSignature {
  id: string
  role: string
  signer: Signer
  x: number
  y: number
  signX: number
  signY: number
  nameX: number
  nameY: number
}

// Each signatory prints what the layout holds. An organizer with no name signs as the competition's organizer, and a chairperson with
// no name or signature signs with the ones saved on their account.
export function certificateSignatures(layout: CertificateLayout, organizerName: string, chairperson: Signer): CertificateSignature[] {
  return layout.signatories.map((s) => {
    const signer: Signer =
      s.kind === 'organizer'
        ? { name: s.name || organizerName, signature: s.signature }
        : s.kind === 'chairperson'
          ? { name: s.name || chairperson.name, signature: s.signature ?? chairperson.signature }
          : { name: s.name, signature: s.signature }
    return { id: s.id, role: s.title, signer, x: s.x, y: s.y, signX: s.signX, signY: s.signY, nameX: s.nameX, nameY: s.nameY }
  })
}
