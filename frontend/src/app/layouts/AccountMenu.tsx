import { ChevronDown, LogOut, User } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn.ts'
import { Avatars } from '../../components/Avatars.tsx'
import { initials } from '../../lib/format.ts'

const ITEM = 'flex h-11 w-full items-center gap-3 px-4 text-left text-small font-medium text-neutral-900 transition-colors hover:bg-gold-50 focus-visible:bg-gold-50 focus-visible:outline-none'

// The signed-in person in a navbar: their picture or initials and name open a small menu with their account page and sign out
export function AccountMenu({ name, detail, photo, profile, onSignOut }: { name: string; detail?: string; photo?: string | null; profile?: { to: string; label: string }; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false)
      } else if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-md py-1.5 text-small font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
      >
        {photo ? (
          <Avatars names={[name]} photo={photo} />
        ) : (
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-white/15 font-mono text-xs">
            {initials(name)}
          </span>
        )}
        <span className="hidden max-w-40 truncate sm:block">{name}</span>
        <ChevronDown aria-hidden className={cn('size-4 text-white/60 transition-transform duration-200', open && 'rotate-180')} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="fixed inset-x-3 top-[calc(var(--nav-h,3.5rem)+0.5rem)] z-40 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-sm"
        >
          <div className="flex flex-col border-b border-neutral-200 px-4 pb-3 pt-2">
            <span className="truncate text-small font-medium text-neutral-900">{name}</span>
            {detail && <span className="truncate text-xs text-neutral-500">{detail}</span>}
          </div>
          {profile && (
            <Link role="menuitem" to={profile.to} onClick={() => setOpen(false)} className={ITEM}>
              <User aria-hidden className="size-4 text-neutral-500" strokeWidth={1.75} />
              {profile.label}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className={ITEM}
          >
            <LogOut aria-hidden className="size-4 text-neutral-500" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
