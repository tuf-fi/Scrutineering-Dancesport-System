import { NavLink, Outlet } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { Button } from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { staffNav, type StaffRole } from '../nav.ts'
import { useSignOut } from '../useSignOut.ts'

// Laptop layout: sidebar and top bar. Below lg the sidebar becomes a scrolling strip under the top bar.
export function StaffLayout() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut('/login')
  if (!user) return null
  const items = staffNav[user.role as StaffRole] ?? []

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-neutral-200 px-4 py-6 lg:flex">
        <div className="flex flex-col items-start gap-2 px-3">
          <Brand size="md" />
          <p className="text-small text-neutral-600">{ROLE_LABEL[user.role]}</p>
        </div>
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-small font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-neutral-200 px-4 sm:px-8 lg:justify-end lg:px-12">
          <Brand className="lg:hidden" />
          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <span className="hidden text-small text-neutral-600 sm:inline">{user.name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        <nav
          aria-label="Sections"
          className="no-scrollbar flex overflow-x-auto border-b border-neutral-200 px-4 sm:px-8 lg:hidden"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px mr-6 shrink-0 whitespace-nowrap border-b-2 py-3 text-small font-semibold last:mr-0',
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

        <main className="flex-1 px-4 py-10 sm:px-8 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
