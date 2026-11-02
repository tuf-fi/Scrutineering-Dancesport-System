import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { Skeleton } from '../../components/ui/index.ts'
import { useUpcomingCompetitions } from '../../hooks/index.ts'
import { HERO_IMAGE } from '../../lib/hero.ts'
import { formatDate } from '../../lib/format.ts'

const SLIDE_MS = 5000

// Rotates through the upcoming competitions over the photo; pauses on hover and focus, and stays still for reduced motion
function UpcomingCarousel() {
  const list = useUpcomingCompetitions()?.list
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = list?.length ?? 0

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS)
    return () => clearInterval(timer)
  }, [count, paused])

  if (!list) return <Skeleton className="absolute bottom-10 left-10 h-16 w-64 bg-brown-800!" />
  const current = list[index % count]
  if (!current) return null

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-linear-to-t from-black/85 via-black/50 to-transparent px-10 pb-10 pt-28 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="text-small font-medium text-white/60">Upcoming events</p>
      <div key={current.id} aria-live={paused ? 'polite' : 'off'} className="flex min-h-28 animate-fade-in flex-col gap-1">
        <Link to={`/competitions/${current.id}`} className="w-fit text-balance text-display font-semibold hover:underline">
          {current.name}
        </Link>
        <p className="mt-1 font-mono text-body tabular-nums text-white">{formatDate(current.date)}</p>
        <p className="text-body text-brown-100">{current.venue}</p>
      </div>
      {count > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="Upcoming competitions">
          {list.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={c.name}
              onClick={() => setIndex(i)}
              className="group py-2"
            >
              <span className="block h-0.5 w-10 bg-white/25 group-hover:bg-white/50">
                {i === index && (
                  <span
                    key={index}
                    style={{ animationPlayState: paused ? 'paused' : 'running' }}
                    className="block h-full w-full animate-[slide-progress_5000ms_linear] bg-gold-400 motion-reduce:animate-none"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Sign-in layout: the form on the left, a full-height photo on the right from laptop width
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [heroFailed, setHeroFailed] = useState(false)

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col">
        <div className="bg-black px-6 py-1 sm:px-12 lg:hidden">
          <Brand size="md" plate={false} />
        </div>
        <div className="flex flex-1 flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:px-20 lg:py-10">
          <Link to="/" className="w-fit text-small font-semibold text-neutral-600 hover:text-neutral-900">
            <span aria-hidden>←</span> Back to the site
          </Link>
          <div className="w-full max-w-sm">
            <h1 className="text-balance text-display font-semibold text-neutral-900">{title}</h1>
            {description && <p className="mt-2 text-body text-neutral-600">{description}</p>}
            <div className="mt-8">{children}</div>
            <div className="mt-10 flex flex-col gap-3 text-small">{footer}</div>
          </div>
          <span aria-hidden />
        </div>
      </div>

      <aside className="sticky top-0 hidden h-dvh self-start overflow-hidden bg-black lg:block">
        {!heroFailed && (
          <img src={HERO_IMAGE} alt="" onError={() => setHeroFailed(true)} className="absolute inset-0 size-full object-cover opacity-80" />
        )}
        <div className="absolute left-0 top-0 bg-black px-10 py-3">
          <Brand size="md" plate={false} />
        </div>
        <UpcomingCarousel />
      </aside>
    </div>
  )
}
