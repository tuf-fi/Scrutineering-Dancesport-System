import { create } from 'zustand'

interface ConnectionStore {
  online: boolean
  setOnline: (online: boolean) => void
  toggle: () => void
}

// Whether this device can reach the venue server. useRealtime sets it from the socket and from every request;
// in the sample app the badge is a manual switch.
export const useConnection = create<ConnectionStore>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
  toggle: () => set((s) => ({ online: !s.online })),
}))
