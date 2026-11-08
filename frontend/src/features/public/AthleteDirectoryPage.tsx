import type { AgeGroup } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { EmptyState, ErrorState, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useTeams, useCompetitors, useRankingPoints, useCatalog, useBicolAthleteIds } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { competitorName } from '../../lib/format.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'

const COLS = 'lg:grid-cols-[minmax(0,1.6fr)_8rem_minmax(0,1fr)_5rem_1.5rem]'

// Bicol athletes: those with a ranking entry in Juvenile, Junior or Youth, with the age group they scored the most points in
export function AthleteDirectoryPage() {
  const { catalog, ageGroups, ageGroupLabel } = useCatalog()
  const competitors = useCompetitors()
  const teams = useTeams()
  const points = useRankingPoints()
  const listed = useBicolAthleteIds()
  const [query, setQuery] = useState('')
  const [ageGroup, setAgeGroup] = useState('all')

  const rows = useMemo(() => {
    const teamById = new Map((teams.data ?? []).map((c) => [c.id, c.name]))
    const byAthlete = new Map<string, { total: number; byAge: Map<AgeGroup, number> }>()
    for (const p of points.data ?? []) {
      const entry = byAthlete.get(p.competitorId) ?? { total: 0, byAge: new Map<AgeGroup, number>() }
      entry.total += p.points
      entry.byAge.set(p.ageGroup, (entry.byAge.get(p.ageGroup) ?? 0) + p.points)
      byAthlete.set(p.competitorId, entry)
    }
    const shown = new Set(listed.data ?? [])
    return (competitors.data ?? [])
      .filter((c) => shown.has(c.id))
      .map((c) => {
        const scored = byAthlete.get(c.id)
        const age = scored ? [...scored.byAge].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined
        return { competitor: c, team: teamById.get(c.teamId), age, total: scored?.total ?? 0 }
      })
      .sort((a, b) => competitorName(a.competitor.names).localeCompare(competitorName(b.competitor.names)))
  }, [competitors.data, teams.data, points.data, listed.data])

  const loading = competitors.isLoading || teams.isLoading || points.isLoading || listed.isLoading
  // An age group is offered only when someone in the list scored in it; a retired version counts as its family
  const familyOf = (id: string) => catalog.ageGroups.find((g) => g.id === id)?.family ?? id
  const present = new Set(rows.flatMap((r) => (r.age ? [familyOf(r.age)] : [])))
  const offered = loading ? ageGroups : ageGroups.filter((g) => present.has(g.family ?? g.id))

  const needle = query.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (ageGroup === 'all' || (r.age !== undefined && familyOf(r.age) === familyOf(ageGroup))) &&
      (!needle || `${competitorName(r.competitor.names)} ${r.team ?? ''} `.toLowerCase().includes(needle)),
  )
  const { page, setPage, pageSize, total, pageItems } = usePagination(visible, `${ageGroup}|${needle}`)

  if (competitors.isError || teams.isError || points.isError || listed.isError) {
    return <ErrorState onRetry={() => void Promise.all([competitors.refetch(), teams.refetch(), points.refetch(), listed.refetch()])} />
  }


  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        title="Bicol Athletes"
        eyebrow="Directory"
        description="Solos and Couples athletes competition track record."
        aside={
          <HeaderStats>
            <HeaderStat value={loading ? '–' : rows.length} label="Bicol athletes" />
            <HeaderStat value={loading ? '–' : new Set((teams.data ?? []).map((c) => c.id)).size} label="Teams" />
          </HeaderStats>
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" label="Search Bicol athletes" value={query} onChange={setQuery} />
        {offered.length > 0 && (
          <Select label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="col-span-2 sm:col-span-1">
            <option value="all">All age groups</option>
            {offered.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <section aria-labelledby="directory" className="flex flex-col gap-4">
        <h2 id="directory" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          All Bicol athletes
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
            title={needle || ageGroup !== 'all' ? 'No Bicol athletes match' : 'No Bicol athletes yet'}
            description={needle || ageGroup !== 'all' ? 'Try a different name, team or age group.' : 'Athletes appear here once they earn points in a ranking event.'}
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
            <ul aria-label="Bicol athletes" className="border-b border-neutral-200">
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
                        {[r.team, r.age && ageGroupLabel(r.age)].filter(Boolean).join(' / ')}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-small text-neutral-700 lg:block">{r.age ? ageGroupLabel(r.age) : '–'}</span>
                  <span className="hidden truncate text-small text-neutral-600 lg:block">{r.team}</span>
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

        {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Bicol athletes pagination" />}
      </section>
    </div>
  )
}
