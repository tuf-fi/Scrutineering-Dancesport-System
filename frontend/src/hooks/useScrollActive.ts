import { useEffect, useRef } from 'react'

// Scrolls a navigation list (never the page) just far enough that its current link is in view
export function scrollActiveIntoView(nav: HTMLElement | null) {
  const link = nav?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!nav || !link) return
  const box = nav.getBoundingClientRect()
  const at = link.getBoundingClientRect()
  const gap = 12
  if (at.top < box.top) nav.scrollTop -= box.top - at.top + gap
  else if (at.bottom > box.bottom) nav.scrollTop += at.bottom - box.bottom + gap
  if (at.left < box.left) nav.scrollLeft -= box.left - at.left + gap
  else if (at.right > box.right) nav.scrollLeft += at.right - box.right + gap
}

// For a navigation that can scroll (a long sidebar, a strip of tabs on a phone): after a reload or a move to another
// page, the current link is brought into view. Pass what should trigger it again, such as the path.
export function useScrollActive<T extends HTMLElement>(...triggers: unknown[]) {
  const ref = useRef<T>(null)
  useEffect(() => {
    // After the links have taken their current state
    const frame = requestAnimationFrame(() => scrollActiveIntoView(ref.current))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, triggers)
  return ref
}
