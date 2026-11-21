import { useEffect, useState } from 'react'

const PAGE = 10

// Ten lines to a page, opening on the page of `startAt`. The arrow keys turn the pages (the count sits by the
// competition name); this listens before the
// slide keys, which skip a key that is already handled.
export function usePaging(total: number, startAt = 0, enabled = true) {
  const [chosen, setChosen] = useState<number | null>(null)
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const page = Math.min(chosen ?? Math.floor(Math.max(0, startAt) / PAGE), pages - 1)

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest('input,select,textarea'))) return
      const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown'
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp'
      if (!forward && !back) return
      e.preventDefault()
      setChosen(Math.max(0, Math.min(pages - 1, page + (forward ? 1 : -1))))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, page, pages])

  return { page, pages, from: page * PAGE, to: page * PAGE + PAGE, setPage: setChosen }
}

export type Paging = ReturnType<typeof usePaging>
