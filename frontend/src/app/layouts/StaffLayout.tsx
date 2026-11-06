import { Role } from '@bis/shared'
import { Outlet, useLocation } from 'react-router'
import { BackupNotice } from '../../components/BackupNotice.tsx'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { cn } from '../../lib/cn.ts'
import { useAuth } from '../../stores/auth.ts'
import { useUi } from '../../stores/ui.ts'
import { barkerNav, compereNav, staffNav, type StaffRole } from '../nav.ts'
import { MobileNav } from './MobileNav.tsx'
import { Sidebar } from './Sidebar.tsx'

// Laptop: a collapsible sidebar that also holds the connection status and sign out, with no top bar.
// Smaller screens: a black top bar with a menu drawer holding the same sections.
export function StaffLayout() {
  const user = useAuth((s) => s.user)
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const desktop = useMediaQuery('(min-width: 1024px)')
  // The fees page uses the whole width; the other screens stay in a readable column
  const { pathname } = useLocation()
  const wide = ['/admin/fees', '/admin/points', '/account'].some((p) => pathname.startsWith(p))
  if (!user) return null
  const items = staffNav[user.role as StaffRole] ?? (user.role === Role.Compere ? compereNav : user.role === Role.Barker ? barkerNav : [])

  return (
    <div
      data-collapsed={collapsed}
      className="min-h-dvh lg:pl-60 lg:transition-[padding-left] lg:duration-200 lg:data-[collapsed=true]:pl-[4.5rem]"
    >
      {desktop && <Sidebar items={items} />}

      <div className="flex min-w-0 flex-col">
        {!desktop && <MobileNav items={items} />}

        <BackupNotice />
        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className={cn('mx-auto w-full', !wide && 'max-w-6xl')}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
