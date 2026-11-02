import { AgeGroup } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { EmptyState, ErrorState, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useClubs, useCompetitors, useRankingPoints } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { AGE_GROUP_LABEL, competitorName } from '../../lib/format.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'

const COLS = 'lg:grid-cols-[minmax(0,1.6fr)_8rem_minmax(0,1fr)_5rem_1.5rem]'

// Everyone who has danced here, with the age group they have scored the most points in
export function AthleteDirectoryPage() {
  const competitors = useCompetitors()
  const clubs = useClubs()
  const points = useRankingPoints()
  const [query, setQuery] = useState('')
  const [ageGroup, setAgeGroup] = useState('all')

  const rows = useMemo(() => {
    const clubById = new Map((clubs.data ?? []).map((c) => [c.id, c.name]))
    const byAthlete = new Map<string, { total: number; byAge: Map<AgeGroup, number> }>()
    for (const p of points.data ?? []) {
      const entry = byAthlete.get(p.competitorId) ?? { total: 0, byAge: new Map<AgeGroup, number>() }
      entry.total += p.points
      entry.byAge.set(p.ageGroup, (entry.byAge.get(p.ageGroup) ?? 0) + p.points)
      byAthlete.set(p.competitorId, entry)
    }
    return (competitors.data ?? [])
      .map((c) => {
        const scored = byAthlete.get(c.id)
        const age = scored ? [...scored.byAge].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined
        return { competitor: c, club: clubById.get(c.clubId), age, total: scored?.total ?? 0 }
      })
      .sort((a, b) => competitorName(a.competitor.names).localeCompare(competitorName(b.competitor.names)))
  }, [competitors.data, clubs.data, points.data])

  const needle = query.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (ageGroup === 'all' || r.age === ageGroup) &&
      (!needle || `${competitorName(r.competitor.names)} ${r.club ?? ''} `.toLowerCase().includes(needle)),
  )
  const { page, setPage, pageSize, total, pageItems } = usePagination(visible, `${ageGroup}|${needle}`)

  if (competitors.isError || clubs.isError || points.isError) {
    return <ErrorState onRetry={() => void Promise.all([competitors.refetch(), clubs.refetch(), points.refetch()])} />
  }

  const loading = competitors.isLoading || clubs.isLoading || points.isLoading

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        title="Athletes"
        eyebrow="Directory"
        description="Every athlete and couple who has danced on BIS. Open a name for their full record."
        aside={
          <HeaderStats>
            <HeaderStat value={loading ? '–' : rows.length} label="Athletes" />
            <HeaderStat value={loading ? '–' : new Set((clubs.data ?? []).map((c) => c.id)).size} label="Clubs" />
          </HeaderStats>
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" label="Search athletes" value={query} onChange={setQuery} />
        <Select label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="col-span-2 sm:col-span-1">
          <option value="all">All age groups</option>
          {Object.values(AgeGroup).map((a) => (
            <option key={a} value={a}>
              {AGE_GROUP_LABEL[a]}
            </option>
          ))}
        </Select>
      </div>

      <section aria-labelledby="directory" className="flex flex-col gap-4">
        <h2 id="directory" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          All athletes
        </h2>

        {loading ? (
          <div aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-neutral-200 py-4 sm:px-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={needle || ageGroup !== 'all' ? 'No athletes match' : 'No athletes yet'}
            description={needle || ageGroup !== 'all' ? 'Try a different name, club or age group.' : 'Athletes appear here once they are entered in a competition.'}
          />
        ) : (
          <div>
            <div aria-hidden className={cn('hidden gap-x-8 px-3 pb-3 font-mono text-xs uppercase text-neutral-500 lg:grid', COLS)}>
              <span>Athlete</span>
              <span>Age group</span>
              <span>Represents</span>
              <span className="text-right">Points</span>
              <span />
            </div>
            <ul aria-label="Athletes" className="border-b border-neutral-200">
              {pageItems.map((r) => (
                <li
                  key={r.competitor.id}
                  className={cn(
                    'group relative grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 border-t border-neutral-200 py-4 transition-colors hover:bg-gold-50 sm:px-3 lg:gap-x-8 lg:py-5',
                    COLS,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatars names={r.competitor.names} />
                    <div className="flex min-w-0 flex-col">
                      <Link
                        to={`/competitors/${r.competitor.id}`}
                        state={{ from: 'athletes' }}
                        className="truncate font-semibold text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500"
                      >
                        {competitorName(r.competitor.names)}
                      </Link>
                      <span className="truncate text-small text-neutral-600 lg:hidden">
                        {[r.club, r.age && AGE_GROUP_LABEL[r.age]].filter(Boolean).join(' / ')}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-small text-neutral-700 lg:block">{r.age ? AGE_GROUP_LABEL[r.age] : '–'}</span>
                  <span className="hidden truncate text-small text-neutral-600 lg:block">{r.club}</span>
                  <span className="flex items-baseline justify-self-end">
                    <span className="text-[1.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-neutral-900">{r.total}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="hidden size-5 text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 lg:block"
                    strokeWidth={1.5}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Athletes pagination" />}
      </section>
    </div>
  )
}
