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
