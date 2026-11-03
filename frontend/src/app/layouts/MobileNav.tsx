import * as RadixDialog from '@radix-ui/react-dialog'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { Brand } from '../../components/Brand.tsx'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import { cn } from '../../lib/cn.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useConnection } from '../../stores/connection.ts'
import { useAuth } from '../../stores/auth.ts'
import { STAFF_SIGN_IN, type NavItem } from '../nav.ts'
import { useSignOut } from '../useSignOut.ts'

// Phones and tablets: a slim black bar, and the same grouped sections as the laptop sidebar in a drawer from the right
export function MobileNav({ items }: { items: NavItem[] }) {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut(STAFF_SIGN_IN)
  const [open, setOpen] = useState(false)
  const online = useConnection((s) => s.online)
  if (!user) return null

  const groups = items.reduce<Array<{ label: string; items: NavItem[] }>>((all, item) => {
    const label = item.group ?? ''
    const last = all[all.length - 1]
    if (last && last.label === label) last.items.push(item)
    else all.push({ label, items: [item] })
    return all
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-black pl-4 pr-3 text-white sm:px-6">
      <Link to="/" aria-label="Home" className="mr-auto">
        <Brand size="sm" plate={false} />
      </Link>
      {!online && <ConnectionStatus />}
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Trigger asChild>
          <button type="button" aria-label="Open menu" className="-mr-1 grid size-10 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-gold-300">
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        </RadixDialog.Trigger>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-black/50 data-[state=closed]:animate-fade-out" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-[60] flex w-[min(20rem,85vw)] animate-drawer-in flex-col bg-neutral-50 data-[state=closed]:animate-drawer-out shadow-overlay focus:outline-none"
          >
            <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
            <div className="flex items-center justify-between bg-black px-4 py-2">
              <Brand size="md" plate={false} />
              <RadixDialog.Close aria-label="Close menu" className="grid size-9 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                <X aria-hidden className="size-5" strokeWidth={1.75} />
              </RadixDialog.Close>
            </div>
            <Link to="/account" onClick={() => setOpen(false)} className="mx-3 mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-100">
              <Avatars names={[user.name]} size="lg" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-small font-semibold text-neutral-900">{user.name}</span>
                <span className="truncate text-xs text-neutral-500">{ROLE_LABEL[user.role]}</span>
              </span>
            </Link>
            <nav aria-label="Sections" className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
              {groups.map((group, i) => (
                <div key={group.label || i} role="group" aria-label={group.label || undefined} className="flex flex-col gap-0.5">
                  {group.label && <p aria-hidden className={cn('px-3 pb-1 font-mono text-[0.6875rem] uppercase tracking-wide text-neutral-400', i === 0 ? 'pt-0' : 'pt-5')}>{group.label}</p>}
                  {group.items.map(({ to, label, end, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex h-11 items-center gap-3 rounded-md border-l-2 px-3 text-small font-medium transition-colors',
                          isActive ? 'border-gold-400 bg-white text-neutral-900' : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                        )
                      }
                    >
                      {Icon && <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />}
                      {label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <button type="button" onClick={signOut} className="flex h-12 items-center gap-3 border-t border-neutral-200 px-6 text-small font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900">
              <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
              Sign out
            </button>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </header>
  )
}
