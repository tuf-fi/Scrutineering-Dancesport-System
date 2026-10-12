import { NavLink, Outlet } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { Button } from '../../components/ui/index.ts'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { cn } from '../../lib/cn.ts'
import { useAuth } from '../../stores/auth.ts'
import { useUi } from '../../stores/ui.ts'
import { staffNav, type StaffRole } from '../nav.ts'
import { useSignOut } from '../useSignOut.ts'
import { Sidebar } from './Sidebar.tsx'

// Laptop: a collapsible sidebar that also holds the connection status and sign out, with no top bar.
// Smaller screens: a top bar with a scrolling strip of sections under it.
export function StaffLayout() {
  const user = useAuth((s) => s.user)
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const signOut = useSignOut('/login')
  if (!user) return null
  const items = staffNav[user.role as StaffRole] ?? []

  return (
    <div
      data-collapsed={collapsed}
      className="min-h-dvh lg:pl-60 lg:transition-[padding-left] lg:duration-200 lg:data-[collapsed=true]:pl-[4.5rem]"
    >
      {desktop && <Sidebar items={items} />}

      <div className="flex min-w-0 flex-col">
        {!desktop && (
          <>
            <header className="flex h-14 items-center justify-between gap-4 border-b border-neutral-200 px-4 sm:px-8">
              <Brand />
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
              className="no-scrollbar flex overflow-x-auto border-b border-neutral-200 px-4 sm:px-8"
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
          </>
        )}

        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
