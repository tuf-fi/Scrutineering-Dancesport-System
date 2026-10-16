import { Outlet } from 'react-router'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { Button } from '../../components/ui/index.ts'
import { useOutboxFlush } from '../../features/adjudicator/useFloor.ts'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'

// Full-screen layout with no sidebar. One column that starts as a phone and widens with the screen,
// so the same screens work on a phone, a tablet and a laptop.
export function AdjudicatorLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/adjudicator')
  useOutboxFlush(user?.id ?? '')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-100">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-neutral-900 font-mono text-xs font-semibold text-white">
              {user.letter}
            </span>
            <span className="text-small font-medium text-neutral-900">{user.name}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <ConnectionStatus />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
