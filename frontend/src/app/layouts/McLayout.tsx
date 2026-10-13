import { Outlet } from 'react-router'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'

// LED wall layout: pure black, no chrome. Sign out sits in a corner and only appears when pointed at.
export function McLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/login')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <main className="flex flex-1 flex-col p-[4vmin]">
        <Outlet />
      </main>
      <button
        onClick={signOut}
        className="fixed right-4 top-4 rounded-md px-3 py-2 text-small font-medium text-neutral-200 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        Sign out
      </button>
    </div>
  )
}
