import * as RadixDialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { cn } from '../../lib/cn.ts'
import { SignInChooser } from '../../components/SignInChooser.tsx'
import { Button } from '../../components/ui/index.ts'
import { useAuth } from '../../stores/auth.ts'
import type { NavItem } from '../nav.ts'

// Phones: the site's links and the sign-in in a drawer from the right, opened from a hamburger at the right of the navbar
export function PublicMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const signedIn = useAuth((s) => s.user !== null)
  const { pathname } = useLocation()

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button type="button" aria-label="Open menu" className="-mr-2 grid size-10 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-gold-300 lg:hidden">
          <Menu aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-black/50 data-[state=closed]:animate-fade-out" />
        <RadixDialog.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-[60] flex w-[min(20rem,85vw)] animate-drawer-in flex-col bg-black data-[state=closed]:animate-drawer-out text-white shadow-overlay focus:outline-none">
          <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
          <div className="flex items-center justify-between px-4 py-2">
            <Brand size="md" plate={false} />
            <RadixDialog.Close aria-label="Close menu" className="grid size-9 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </RadixDialog.Close>
          </div>
          <nav aria-label="Menu" className="flex flex-col gap-1 border-t border-white/10 px-3 py-4">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-12 items-center border-l-2 px-4 text-body font-semibold transition-colors',
                    isActive || item.also?.some((p) => pathname.startsWith(p)) ? 'border-gold-400 bg-white/10 text-white' : 'border-transparent text-white/65 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {!signedIn && (
            <div className="mt-auto border-t border-white/10 p-4">
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false)
                  setChoosing(true)
                }}
              >
                Sign in
              </Button>
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
      <SignInChooser open={choosing} onClose={() => setChoosing(false)} />
    </RadixDialog.Root>
  )
}
