import type { Competition } from '@bis/shared'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router'
import { Skeleton } from '../../../components/ui/index.ts'
import { dateParts, todayIso } from '../../../lib/format.ts'
import { HERO_IMAGE } from '../../../lib/hero.ts'
import { SectionHead } from './SectionHead.tsx'

const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86_400_000)

// One photo card per competition: the date and countdown on top, the name and venue at the foot
export function UpcomingEvents({ list, upcoming }: { list: Competition[] | undefined; upcoming: boolean }) {
  const shown = upcoming ? (list ?? []).slice(0, 6) : []

  return (
    <section aria-label="Upcoming events" className="flex flex-col gap-6">
      <SectionHead title="Upcoming events" note="Dates and venues of the next competitions. Open one to see its events and register." to="/competitions" linkLabel="All competitions" />
      {!list ? (
        <Skeleton className="h-48 w-full" />
      ) : shown.length === 0 ? (
        <div className="flex items-start gap-4 rounded-lg border border-dashed border-neutral-300 p-6">
          <CalendarDays aria-hidden className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold text-neutral-900">No dates are set yet</p>
            <p className="text-small text-neutral-600">New events appear here as soon as they are announced.</p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => {
            const d = dateParts(c.date)
            const days = daysUntil(c.date)
            return (
              <li key={c.id}>
                <article className="group relative isolate flex aspect-square flex-col justify-between overflow-hidden rounded-lg bg-black p-6 text-white sm:aspect-[4/5]">
                  <img
                    src={HERO_IMAGE}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-20 size-full object-cover object-[50%_18%] grayscale transition duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
                  />
                  <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55),transparent_35%,transparent_40%,rgb(0_0_0/0.9))]" />
                  {/* The whole card opens the event; Register sits above it as its own link */}
                  <Link to={`/competitions/${c.id}`} className="absolute inset-0 rounded-lg">
                    <span className="sr-only">{c.name}</span>
                  </Link>
                  <span className="pointer-events-none flex items-start justify-between gap-4">
                    <span className="flex flex-col gap-1.5">
                      <span className="text-[3rem] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">{d.day}</span>
                      <span className="whitespace-nowrap font-mono text-xs font-medium uppercase tabular-nums text-white transition-colors duration-300 group-hover:text-gold-300">
                        {d.month} {d.year}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-medium uppercase tabular-nums text-white/80">{days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}</span>
                  </span>
                  <span className="pointer-events-none flex items-end justify-between gap-4 transition-transform duration-500 ease-out group-hover:-translate-y-12 group-focus-within:-translate-y-12 [@media(hover:none)]:-translate-y-12">
                    <span className="flex flex-col gap-1.5">
                      <span className="text-balance text-[1.25rem] font-semibold leading-[1.2] tracking-[-0.015em]">{c.name}</span>
                      <span className="text-small text-white/75">{c.venue}</span>
                    </span>
                    <ArrowUpRight aria-hidden className="size-6 shrink-0 transition-opacity duration-300 group-hover:opacity-0" strokeWidth={1.5} />
                  </span>
                  <Link
                    to="/athlete"
                    className="group/register absolute inset-x-0 bottom-0 z-10 flex h-14 translate-y-full items-center justify-between bg-gold-400 px-6 text-small font-semibold text-black transition duration-500 ease-out hover:bg-gold-300 group-hover:translate-y-0 focus-visible:translate-y-0 [@media(hover:none)]:translate-y-0"
                  >
                    Register
                    <ArrowUpRight aria-hidden className="size-5 transition-transform duration-300 group-hover/register:rotate-45" strokeWidth={1.75} />
                  </Link>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
