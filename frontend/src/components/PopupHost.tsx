import { Role, type AlertNote } from '@bis/shared'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../api/index.ts'
import { useMyNotifications } from '../hooks/index.ts'
import { playChime } from '../lib/chime.ts'
import { usePopups, type Popup } from '../stores/popups.ts'
import { useAuth } from '../stores/auth.ts'

const SHOW_MS = 9000

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

  useEffect(() => {
    const timer = setTimeout(() => dismiss(popup.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [popup.id, dismiss])

  const open = () => {
    dismiss(popup.id)
    if (popup.link) void navigate(popup.link)
  }

  return (
    <li className="pointer-events-auto flex animate-fade-in items-stretch border border-l-2 border-neutral-200 border-l-gold-400 bg-white shadow-overlay">
      <button type="button" onClick={open} className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-gold-50 focus-visible:bg-gold-50 focus-visible:outline-none">
        <span className="text-small font-semibold text-neutral-900">{popup.title}</span>
        {popup.detail && <span className="text-xs text-neutral-600">{popup.detail}</span>}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(popup.id)}
        className="grid w-10 shrink-0 place-items-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:bg-neutral-100"
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
