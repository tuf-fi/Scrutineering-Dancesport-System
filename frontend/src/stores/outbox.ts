import { create } from 'zustand'
import { loadPending, removePending, savePending, type PendingSubmission } from '../lib/phoneDb.ts'

export type { PendingSubmission } from '../lib/phoneDb.ts'

interface OutboxStore {
  pending: PendingSubmission | null
  // Saves the marks on the phone first; resolves once they are safely stored
  save: (pending: Omit<PendingSubmission, 'savedAt'>) => Promise<void>
  // The server has the marks (or refused them for good): forget them, and pick up any older ones
  clear: () => Promise<void>
  // After a page load: read what the phone was still holding
  restore: () => Promise<void>
}

// Marks wait here, and in the phone's own storage, until the server has confirmed them. A refresh, a crashed
// browser or a dead battery cannot lose them, and they go out again when the phone is back on the Wi-Fi.
export const useOutbox = create<OutboxStore>((set, get) => ({
  pending: null,
  save: async (marks) => {
    const pending = { ...marks, savedAt: new Date().toISOString() }
    // Stored before anything is sent
    await savePending(pending)
    set({ pending })
  },
  clear: async () => {
    const current = get().pending
    if (!current) return
    set({ pending: null })
    await removePending(current)
    set({ pending: await loadPending() })
  },
  restore: async () => set({ pending: await loadPending() }),
}))
