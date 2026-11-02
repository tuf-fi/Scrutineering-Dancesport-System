import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../../lib/cn.ts'

export type NavSection = { to: string; label: string; icon: LucideIcon; end?: boolean }
export type NavGroup = { label: string; items: NavSection[] }

// The black sidebar of an account (athlete, coach, team): a strip of tabs on phones, fixed under the navbar from laptop width
export function AccountNav({ groups }: { groups: NavGroup[] }) {
  return (
    <nav aria-label="Account" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg bg-black p-2 lg:fixed lg:bottom-0 lg:left-0 lg:top-[var(--nav-h)] lg:z-20 lg:w-60 lg:flex-col lg:overflow-y-auto lg:rounded-none lg:p-4">
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className="flex gap-1 lg:flex-col lg:pb-5">
          <p aria-hidden className="hidden px-4 pb-2 font-mono text-xs uppercase tracking-wide text-white/40 lg:block">
            {group.label}
          </p>
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-md border-l-2 px-4 py-3 text-small font-semibold transition-colors',
                  isActive ? 'border-gold-400 bg-white/10 text-white' : 'border-transparent text-white/65 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon aria-hidden className="hidden size-4 lg:block" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
