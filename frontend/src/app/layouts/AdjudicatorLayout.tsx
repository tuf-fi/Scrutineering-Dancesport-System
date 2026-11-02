import { Outlet } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { useOutboxFlush } from '../../features/adjudicator/useFloor.ts'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'
import { AccountMenu } from './AccountMenu.tsx'

// Full-screen layout with no sidebar. One column that starts as a phone and widens with the screen,
// so the same screens work on a phone, a tablet and a laptop. The black navbar matches the rest of the site.
export function AdjudicatorLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/adjudicator')
  useOutboxFlush(user?.id ?? '')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand size="sm" plate={false} />
          <div className="flex items-center gap-3 sm:gap-4">
            <ConnectionStatus />
            <AccountMenu name={user.name} detail={user.letter ? `Adjudicator ${user.letter}` : 'Adjudicator'} onSignOut={signOut} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
