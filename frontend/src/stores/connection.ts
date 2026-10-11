import { create } from 'zustand'

interface ConnectionStore {
  online: boolean
  setOnline: (online: boolean) => void
  toggle: () => void
}

// TODO: drive from the real venue-server connection in phase 3; for now it is a manual demo switch
export const useConnection = create<ConnectionStore>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
  toggle: () => set((s) => ({ online: !s.online })),
}))
