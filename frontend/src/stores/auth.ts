import type { SessionUser } from '@bis/shared'
import { create } from 'zustand'

interface AuthStore {
  user: SessionUser | null
  signIn: (user: SessionUser) => void
  signOut: () => void
}

// Who is signed in on this device. The session itself is an httpOnly cookie the browser keeps; this only
// mirrors it for the screens, and is filled again from the server when the page loads (app/session.ts).
export const useAuth = create<AuthStore>()((set) => ({
  user: null,
  signIn: (user) => set({ user }),
  signOut: () => set({ user: null }),
}))
