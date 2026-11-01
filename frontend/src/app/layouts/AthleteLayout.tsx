import { Link, Outlet } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { Button } from '../../components/ui/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { useSignOut } from '../useSignOut.ts'

// The athlete's own page: one column, and a way back to the public results
export function AthleteLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/athlete/sign-in')
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link to="/">
            <Brand />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-small font-medium text-neutral-900">{user.name}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  )
}
