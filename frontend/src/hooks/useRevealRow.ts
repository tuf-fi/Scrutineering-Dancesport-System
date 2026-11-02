import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

// How long the revealed row stays marked
const MARK_MS = 3500

// Opens a list on the page that holds one row, then scrolls to it and marks it for a moment.
// The row to find comes from the address (?highlight=<id>, or the name given), so a link from anywhere can point at it.
// `ready` is false while the list is still loading. Give the row `data-row={id}` and use `revealed` to mark it.
export function useRevealRow<T>(items: T[], idOf: (item: T) => string, pageSize: number, setPage: (page: number) => void, ready: boolean, param = 'highlight') {
  const [params] = useSearchParams()
  const target = params.get(param)
  const done = useRef<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)

  // Find the row, move to its page
  useEffect(() => {
    if (!target || !ready || done.current === target) return
    const index = items.findIndex((item) => idOf(item) === target)
    if (index < 0) return
    done.current = target
    setPage(Math.floor(index / pageSize) + 1)
    setRevealed(target)
  }, [target, ready, items, idOf, pageSize, setPage])

  // The page has changed by the time this runs, so the row is on screen: scroll to it, then let the mark fade
  useEffect(() => {
    if (!revealed) return
    const row = [...document.querySelectorAll<HTMLElement>('[data-row]')].find((el) => el.dataset.row === revealed)
    row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    const timer = setTimeout(() => setRevealed(null), MARK_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  return revealed
}

// The classes of a row that was just revealed: a soft gold wash that fades away when the mark ends
export const REVEALED = 'bg-gold-50'
