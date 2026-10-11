import { Outlet } from 'react-router'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { Button } from '../../components/ui/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'

// Full-screen layout with no sidebar. One column that starts as a phone and widens with the screen,
// so the same screens work on a phone, a tablet and a laptop.
export function AdjudicatorLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/adjudicator')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-title font-semibold">{user.letter}</span>
            <span className="text-small text-neutral-600">{user.name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ConnectionStatus />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12">
        <Outlet />
      </main>
    </div>
  )
}
