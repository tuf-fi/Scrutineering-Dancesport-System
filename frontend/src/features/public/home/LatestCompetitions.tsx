import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { Skeleton } from '../../../components/ui/index.ts'
import { useCompetitions } from '../../../hooks/index.ts'
import { dateParts, todayIso } from '../../../lib/format.ts'
import { SectionHead } from './SectionHead.tsx'

// The three most recent competitions that have started; each row opens that competition's standings
export function LatestCompetitions() {
  const { data, isLoading } = useCompetitions()
  const today = todayIso()
  const latest = [...(data ?? [])].filter((c) => c.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

  return (
    <section aria-label="Latest competitions" className="flex flex-col gap-2">
      <SectionHead title="Latest competitions" note="Open one to see its events and results." to="/competitions" linkLabel="All competitions" />
      {isLoading ? (
        <Skeleton className="mt-6 h-48 w-full" />
      ) : latest.length === 0 ? (
        <p className="border-b border-neutral-200 py-10 text-body text-neutral-600">No competition has been held yet.</p>
      ) : (
        <ul>
          {latest.map((c) => {
            const d = dateParts(c.date)
            return (
              <li key={c.id} className="border-b border-neutral-200">
                <Link to={`/competitions/${c.id}`} className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 px-3 py-7 transition-colors duration-300 hover:bg-gold-50 focus-visible:bg-gold-50 focus-visible:outline-none sm:grid-cols-[9rem_1fr_auto] sm:gap-8 sm:px-4 sm:py-9">
                  <span className="flex flex-col gap-1.5">
                    <span className="text-[clamp(2rem,1.5rem+2vw,3rem)] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums text-neutral-900">{d.day}</span>
                    <span className="font-mono text-xs font-medium uppercase tabular-nums text-gold-700">
                      {d.month} {d.year}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-balance text-[clamp(1.125rem,1rem+0.8vw,1.625rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900">{c.name}</span>
                    <span className="text-small text-neutral-500">{c.venue}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-6 text-neutral-900 transition-transform duration-300 group-hover:rotate-45 group-hover:text-gold-600" strokeWidth={1.5} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
