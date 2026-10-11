import type { ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { Button } from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'
import { useAuth } from '../../stores/auth.ts'
import { clubNav, publicNav, type NavItem } from '../nav.ts'
import { useSignOut } from '../useSignOut.ts'

// Mobile-first top navigation shared by the public site and the club portal
function TopNavLayout({ items, right }: { items: NavItem[]; right: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-10 px-4 sm:px-8">
          <Link to="/" className="py-2">
            <Brand />
          </Link>
          <nav
            aria-label="Main"
            className="no-scrollbar order-3 flex w-full overflow-x-auto sm:order-none sm:w-auto"
          >
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'mr-6 shrink-0 whitespace-nowrap border-b-2 py-3.5 text-small font-semibold last:mr-0',
                    isActive
                      ? 'border-gold-500 text-neutral-900'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">{right}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  )
}

export function PublicLayout() {
  return (
    <TopNavLayout
      items={publicNav}
      right={
        <Link to="/club/sign-in" className="text-small font-semibold text-neutral-700 hover:text-neutral-900">
          Club sign-in
        </Link>
      }
    />
  )
}

export function ClubLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/club/sign-in')
  return (
    <TopNavLayout
      items={clubNav}
      right={
        <>
          <span className="hidden text-small text-neutral-600 sm:inline">{user?.name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </>
      }
    />
  )
}
