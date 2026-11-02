import { Bell, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMarkNotificationsRead, useMyNotifications } from '../../hooks/index.ts'
import { playChime, setSoundOn, soundOn } from '../../lib/chime.ts'
import { cn } from '../../lib/cn.ts'
import { useAuth } from '../../stores/auth.ts'
import { timeAgo } from '../../lib/timeAgo.ts'

const SHOWN = 6

// The bell in the athlete's navbar: a count of what is new, a small list, and a chime when something arrives
export function NotificationBell() {
  const role = useAuth((s) => s.user?.role) ?? 'athlete'
  const notes = useMyNotifications()
  const mark = useMarkNotificationsRead()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sound, setSound] = useState(soundOn)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const list = notes.data ?? []
  const unread = list.filter((n) => n.readAt === null)

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

  function toggleSound() {
    const next = !sound
    setSound(next)
    setSoundOn(next)
    if (next) playChime()
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} new` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.75} />
        {unread.length > 0 && (
          <span aria-hidden className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-gold-400 px-1 font-mono text-[0.625rem] font-semibold leading-4 text-black">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div id={menuId} role="menu" className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <p className="text-small font-bold uppercase tracking-wide text-neutral-900">Notifications</p>
            <div className="flex items-center gap-1">
              {unread.length > 0 && (
                <button type="button" onClick={() => mark.mutate(undefined)} className="rounded px-1.5 py-1 text-small font-medium text-neutral-600 hover:text-neutral-900">
                  Mark all read
                </button>
              )}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={sound}
                aria-label={sound ? 'Turn the sound off' : 'Turn the sound on'}
                onClick={toggleSound}
                className="grid size-7 place-items-center rounded text-neutral-500 hover:text-neutral-900"
              >
                {sound ? <Volume2 aria-hidden className="size-4" strokeWidth={1.75} /> : <VolumeX aria-hidden className="size-4" strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-small text-neutral-600">Nothing yet. Updates from the secretariat show up here.</p>
          ) : (
            <ul className="no-scrollbar max-h-96 overflow-y-auto">
              {list.slice(0, SHOWN).map((n) => (
                <li key={n.id} className="border-b border-neutral-200 last:border-b-0">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (n.readAt === null) mark.mutate([n.id])
                      setOpen(false)
                      if (n.link) navigate(n.link)
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gold-50 focus-visible:bg-gold-50 focus-visible:outline-none"
                  >
                    <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt === null ? 'bg-gold-400' : 'bg-neutral-200')} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn('text-small text-neutral-900', n.readAt === null ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                      {n.detail && <span className="line-clamp-2 text-small text-neutral-600">{n.detail}</span>}
                      <span className="font-mono text-xs uppercase text-neutral-500">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to={`/${role}/notifications`} onClick={() => setOpen(false)} className="block border-t border-neutral-200 px-4 py-3 text-center text-small font-semibold text-neutral-900 transition-colors hover:bg-gold-50">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
