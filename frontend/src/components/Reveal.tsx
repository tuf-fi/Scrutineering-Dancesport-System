import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

const skipsMotion = () =>
  typeof IntersectionObserver === 'undefined' || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

// Fades and lifts its content into place the first time it scrolls into view
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(skipsMotion)

  useEffect(() => {
    const node = ref.current
    if (shown || !node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [shown])

  return (
    <div ref={ref} className={cn('transition-all duration-700 ease-out', shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0', className)}>
      {children}
    </div>
  )
}
