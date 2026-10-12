import type { MarkSubmission } from '@bis/shared'
import { create } from 'zustand'

export interface PendingSubmission {
  adjudicatorId: string
  roundId: string
  submissions: MarkSubmission[]
}

interface OutboxStore {
  pending: PendingSubmission | null
  save: (pending: PendingSubmission) => void
  clear: () => void
}

// Marks submitted while the Wi-Fi is down wait here and go out when the phone reconnects
// TODO: keep this in IndexedDB so a refresh on the phone cannot lose marks
export const useOutbox = create<OutboxStore>((set) => ({
  pending: null,
  save: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}))
