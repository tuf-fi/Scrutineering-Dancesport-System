import { Role, type AlertNote } from '@bis/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../api/index.ts'
import { useMyNotifications } from '../hooks/index.ts'
import { cn } from '../lib/cn.ts'
import { playChime } from '../lib/chime.ts'
import { usePopups, type Popup } from '../stores/popups.ts'
import { useAuth } from '../stores/auth.ts'

const SHOW_MS = 9000
const LEAVE_MS = 280

// What an athlete, coach or team is told is kept; a new one pops up as it arrives
function AccountPopups() {
  const notes = useMyNotifications()
  const push = usePopups((s) => s.push)
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!notes.data) return
    // The first load only learns what is already there
    const fresh = known.current === null ? [] : notes.data.filter((n) => n.readAt === null && !known.current!.has(n.id))
    known.current = new Set(notes.data.map((n) => n.id))
    for (const n of fresh.reverse()) push({ title: n.title, detail: n.detail, link: n.link })
  }, [notes.data, push])

  return null
}

// What staff are told is not kept: it pops up on the screens open at that moment
function useAlerts(role: Role | undefined) {
  const push = usePopups((s) => s.push)
  useEffect(() => {
    if (!role) return
    return api.subscribeAlerts((note: AlertNote & { roles?: Role[] }) => {
      // The server only sends an alert to the roles it is for; the sample data sends it to everyone and says who it is for
      if (note.roles && !note.roles.includes(role)) return
      push({ title: note.title, detail: note.detail, link: note.link })
    })
  }, [role, push])
}

function Item({ popup }: { popup: Popup }) {
  const dismiss = usePopups((s) => s.dismiss)
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  // Slides out to the right while it fades, then leaves the list
  const leave = useCallback(() => setLeaving(true), [])

  useEffect(() => {
    const timer = setTimeout(leave, SHOW_MS)
    return () => clearTimeout(timer)
  }, [leave])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => dismiss(popup.id), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving, dismiss, popup.id])

  const open = () => {
    leave()
    if (popup.link) void navigate(popup.link)
  }

  return (
    <li
      className={cn(
        'group pointer-events-auto relative border border-l-2 border-neutral-200 border-l-gold-400 bg-white shadow-overlay transition-colors hover:bg-[color-mix(in_srgb,var(--color-gold-50)_50%,white)]',
        leaving ? 'animate-popup-up lg:animate-popup-out' : 'animate-fade-in',
      )}
    >
      <button type="button" onClick={open} className="flex w-full min-w-0 flex-col gap-0.5 py-3 pl-4 pr-12 text-left focus-visible:outline-none">
        <span className="text-small font-semibold text-neutral-900">{popup.title}</span>
        {popup.detail && <span className="text-xs text-neutral-600">{popup.detail}</span>}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={leave}
        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md text-neutral-500 transition-colors group-hover:text-neutral-900 hover:bg-[color-mix(in_srgb,var(--color-gold-100)_60%,white)] focus-visible:bg-[color-mix(in_srgb,var(--color-gold-100)_60%,white)] focus-visible:outline-none"
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </li>
  )
}

// Pop-ups for every signed-in role, with a chime. Bottom right on a laptop; across the top, full width, on phones and tablets.
export function PopupHost() {
  const role = useAuth((s) => s.user?.role)
  const items = usePopups((s) => s.items)
  const seen = useRef<Set<string>>(new Set())
  useAlerts(role)

  // One chime for each pop-up that has not been seen before
  useEffect(() => {
    const fresh = items.filter((p) => !seen.current.has(p.id))
    for (const p of fresh) seen.current.add(p.id)
    if (fresh.length > 0) playChime()
  }, [items])

  return (
    <>
      {(role === Role.Athlete || role === Role.Coach || role === Role.Team) && <AccountPopups />}
      <ul aria-live="polite" aria-label="Notifications" className={`pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col gap-2 p-3 lg:inset-x-auto lg:right-4 lg:top-auto lg:w-96 lg:p-0 ${import.meta.env.DEV ? 'lg:bottom-20' : 'lg:bottom-4'}`}>
        {items.map((p) => (
          <Item key={p.id} popup={p} />
        ))}
      </ul>
    </>
  )
}
