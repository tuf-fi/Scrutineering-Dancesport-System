import { create } from 'zustand'
import { loadPending, pruneSent, removePending, savePending, type PendingSubmission } from '../lib/phoneDb.ts'

export type { PendingSubmission } from '../lib/phoneDb.ts'

const KEEP_SENT_MS = 24 * 3_600_000

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
  restore: async () => {
    // Copies of acknowledged marks are kept for a day, in case the server has to be restored from an older backup
    await pruneSent(KEEP_SENT_MS)
    set({ pending: await loadPending() })
  },
}))
