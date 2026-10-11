import type { SessionUser } from '@bis/shared'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  user: SessionUser | null
  signIn: (user: SessionUser) => void
  signOut: () => void
}

// TODO: kept in localStorage so a refresh keeps the sample session; phase 3 uses an httpOnly cookie
export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: 'bis-auth' },
  ),
)
