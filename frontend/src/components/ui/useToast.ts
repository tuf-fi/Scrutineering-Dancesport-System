import { create } from 'zustand'

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, tone = 'neutral') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
