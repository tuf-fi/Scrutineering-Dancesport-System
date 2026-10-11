import { Outlet } from 'react-router'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'

// Projector layout: full screen, black ground, very large text
export function McLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/login')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <main className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-16">
        <Outlet />
      </main>
      <footer className="flex justify-end px-6 pb-6 sm:px-16">
        <button
          onClick={signOut}
          className="rounded-md px-3 py-2 text-small font-medium text-neutral-400 hover:text-white"
        >
          Sign out
        </button>
      </footer>
    </div>
  )
}
