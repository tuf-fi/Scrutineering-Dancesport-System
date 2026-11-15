import { Role } from '@bis/shared'
import { useSheetSignatures } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import type { Signers } from './signers.ts'

// Who signs a final's sheet: the scrutineer who approved it and the chairperson, each with the signature saved on their
// account. A line with no saved signature prints empty, to be signed by hand.
export function useSheetSigners(eventId: string): Signers {
  const user = useAuth((s) => s.user)
  const saved = useSheetSignatures(eventId)
  return {
    scrutineer: { name: saved.data?.scrutineer?.name ?? (user?.role === Role.Scrutineer ? user.name : ''), signature: saved.data?.scrutineer?.signature ?? null },
    chairperson: { name: saved.data?.chairperson?.name ?? (user?.role === Role.Chairperson ? user.name : ''), signature: saved.data?.chairperson?.signature ?? null },
  }
}
