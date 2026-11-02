import { create } from 'zustand'

export interface Popup {
  id: string
  title: string
  detail: string
  // Where in the app it leads
  link: string | null
}

interface PopupStore {
  items: Popup[]
  push: (popup: Omit<Popup, 'id'>) => void
  dismiss: (id: string) => void
}

let counter = 0

// The pop-ups on screen right now; the newest last. A few at most, so a burst never covers the page.
export const usePopups = create<PopupStore>((set) => ({
  items: [],
  push: (popup) => set((s) => ({ items: [...s.items, { ...popup, id: `popup-${++counter}` }].slice(-4) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
}))
