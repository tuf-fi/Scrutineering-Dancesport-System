import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { Brand } from '../../components/Brand.tsx'
import { cn } from '../../lib/cn.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { useConnection } from '../../stores/connection.ts'
import { useUi } from '../../stores/ui.ts'
import type { NavItem } from '../nav.ts'
import { useSignOut } from '../useSignOut.ts'

// A label that appears beside an icon when the sidebar is collapsed
function Tip({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full z-30 ml-3 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-overlay transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  )
}

// The current section is a white row with a hairline border and a gold icon; the rest stay quiet
function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-md border text-small font-medium transition-colors',
          collapsed ? 'justify-center' : 'px-3',
          isActive
            ? 'border-neutral-200 bg-white text-neutral-900'
            : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          {Icon && (
            <Icon
              aria-hidden
              className={cn('size-[18px] shrink-0', isActive && 'text-gold-600')}
              strokeWidth={1.75}
            />
          )}
          {/* Stays in the page for screen readers when the sidebar is collapsed */}
          <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
          {collapsed && <Tip>{item.label}</Tip>}
        </>
      )}
    </NavLink>
  )
}

const footerRow =
  'group relative flex h-9 items-center gap-3 rounded-md text-small font-medium transition-colors'

// Shows the venue connection; clicking flips it so offline screens can be reviewed
function ConnectionRow({ collapsed }: { collapsed: boolean }) {
  const { online, toggle } = useConnection()
  const label = online ? 'Online' : 'Offline'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!online}
      aria-label={online ? 'Online. Switch to offline' : 'Offline. Switch to online'}
      className={cn(footerRow, 'text-neutral-600 hover:bg-neutral-100', collapsed ? 'justify-center' : 'px-3')}
    >
      <span className="grid size-[18px] shrink-0 place-items-center">
        <span aria-hidden className={cn('size-2 rounded-full', online ? 'bg-success' : 'bg-warning')} />
      </span>
      <span className={cn(collapsed && 'sr-only')}>{label}</span>
      {collapsed && <Tip>{label}</Tip>}
    </button>
  )
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const user = useAuth((s) => s.user)
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  const signOut = useSignOut('/login')
  if (!user) return null

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls="staff-sidebar"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="group relative grid size-8 shrink-0 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900"
    >
      <ToggleIcon aria-hidden className="size-[18px]" strokeWidth={1.75} />
      {collapsed && <Tip>Expand sidebar</Tip>}
    </button>
  )

  return (
    <aside
      id="staff-sidebar"
      className={cn(
        // Fixed to the viewport so it never scrolls with the page; the page keeps its own left spacing
        'fixed inset-y-0 left-0 z-20 flex flex-col border-r border-neutral-200 bg-neutral-50 transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 px-2 pb-4 pt-4">
          {toggleButton}
          <Brand size="sm" />
          <div className="group relative">
            <Avatars names={[user.name]} />
            <Tip>{`${user.name} · ${ROLE_LABEL[user.role]}`}</Tip>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="relative flex justify-center px-4 pb-5 pt-6">
            <Brand size="xl" />
            <div className="absolute right-3 top-3">{toggleButton}</div>
          </div>
          <div className="flex items-center gap-3 border-y border-neutral-200 px-5 py-3.5">
            <Avatars names={[user.name]} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-small font-semibold text-neutral-900">{user.name}</span>
              <span className="truncate text-xs text-neutral-600">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scrolls on short screens; collapsed it must not clip the hover tooltips */}
      <nav
        aria-label="Sections"
        className={cn('no-scrollbar flex flex-1 flex-col gap-1 px-3 py-4', !collapsed && 'overflow-y-auto')}
      >
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-neutral-200 p-3">
        <ConnectionRow collapsed={collapsed} />
        <button
          type="button"
          onClick={signOut}
          className={cn(footerRow, 'text-danger hover:bg-danger-soft', collapsed ? 'justify-center' : 'px-3')}
        >
          <LogOut aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className={cn(collapsed && 'sr-only')}>Sign out</span>
          {collapsed && <Tip>Sign out</Tip>}
        </button>
      </div>
    </aside>
  )
}
