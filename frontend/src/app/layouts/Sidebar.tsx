import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { usingMocks } from '../../api/mode.ts'
import { Avatars } from '../../components/Avatars.tsx'
import logo from '../../assets/logo.png'
import { Brand } from '../../components/Brand.tsx'
import { cn } from '../../lib/cn.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { useConnection } from '../../stores/connection.ts'
import { useUi } from '../../stores/ui.ts'
import { STAFF_SIGN_IN, type NavItem } from '../nav.ts'
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

// Shows whether this device can reach the server. In the sample app, clicking flips it so offline screens can be reviewed.
function ConnectionRow({ collapsed }: { collapsed: boolean }) {
  const { online, toggle } = useConnection()
  const label = online ? 'Online' : 'Offline'
  const content = (
    <>
      <span className="grid size-[18px] shrink-0 place-items-center">
        <span aria-hidden className={cn('size-2 rounded-full', online ? 'bg-success' : 'bg-warning')} />
      </span>
      <span className={cn(collapsed && 'sr-only')}>{label}</span>
      {collapsed && <Tip>{label}</Tip>}
    </>
  )
  const className = cn(footerRow, 'text-neutral-600', collapsed ? 'justify-center' : 'px-3')
  if (!usingMocks) {
    return (
      <div role="status" aria-label={online ? 'Connected to the server' : 'Cannot reach the server'} className={className}>
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!online}
      aria-label={online ? 'Online. Switch to offline' : 'Offline. Switch to online'}
      className={cn(className, 'hover:bg-neutral-100')}
    >
      {content}
    </button>
  )
}

// The signed-in person: a card that opens their account page, where they can change their name and password
function AccountLink({ user }: { user: NonNullable<ReturnType<typeof useAuth.getState>['user']> }) {
  return (
    <NavLink
      to="/account"
      className={({ isActive }) =>
        cn(
          'group mx-3 mt-3 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
          isActive ? 'border-neutral-200 bg-white' : 'border-transparent hover:bg-neutral-100',
        )
      }
    >
      <Avatars names={[user.name]} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-small font-semibold text-neutral-900">{user.name}</span>
        <span className="truncate text-xs text-neutral-500">{ROLE_LABEL[user.role]}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500" strokeWidth={1.75} />
    </NavLink>
  )
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const user = useAuth((s) => s.user)
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  const signOut = useSignOut(STAFF_SIGN_IN)
  if (!user) return null

  // Items that share a group sit together under its heading; items without one stay in a single list
  const groups = items.reduce<Array<{ label: string; items: NavItem[] }>>((all, item) => {
    const label = item.group ?? ''
    const last = all[all.length - 1]
    if (last && last.label === label) last.items.push(item)
    else all.push({ label, items: [item] })
    return all
  }, [])

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
        <div className="flex flex-col items-center gap-3 pb-3">
          <div className="flex w-full flex-col items-center gap-2 bg-black px-2 pb-3 pt-3 text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
            {toggleButton}
            {/* The rail is too narrow for the whole logo, so only its emblem shows */}
            <span aria-label="BIS" role="img" className="block h-10 w-11 overflow-hidden">
              <img src={logo} alt="" className="h-10 w-auto max-w-none select-none mix-blend-screen" />
            </span>
          </div>
          <NavLink to="/account" aria-label="My account" className="group relative rounded-full focus-visible:outline-2 focus-visible:outline-gold-500">
            <Avatars names={[user.name]} />
            <Tip>{`${user.name} · ${ROLE_LABEL[user.role]}`}</Tip>
          </NavLink>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="relative flex items-center bg-black px-5 py-3">
            <Brand size="md" plate={false} />
            <div className="absolute right-3 top-3 text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">{toggleButton}</div>
          </div>
          <AccountLink user={user} />
        </div>
      )}

      {/* Scrolls on short screens; collapsed it must not clip the hover tooltips */}
      <nav
        aria-label="Sections"
        className={cn('no-scrollbar flex flex-1 flex-col gap-1 px-3 py-4', !collapsed && 'overflow-y-auto')}
      >
        {groups.map((group, i) => (
          <div key={group.label || i} role="group" aria-label={group.label || undefined} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                i > 0 && <hr aria-hidden className="mx-3 my-2 border-neutral-200" />
              ) : (
                <p aria-hidden className={cn('px-3 pb-1 font-mono text-[0.6875rem] uppercase tracking-wide text-neutral-400', i === 0 ? 'pt-0' : 'pt-5')}>
                  {group.label}
                </p>
              ))}
            {group.items.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-neutral-200 px-3 py-2.5">
        <ConnectionRow collapsed={collapsed} />
        <button
          type="button"
          onClick={signOut}
          className={cn(footerRow, 'text-neutral-500 hover:bg-danger-soft hover:text-danger', collapsed ? 'justify-center' : 'px-3')}
        >
          <LogOut aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className={cn(collapsed && 'sr-only')}>Sign out</span>
          {collapsed && <Tip>Sign out</Tip>}
        </button>
      </div>
    </aside>
  )
}
