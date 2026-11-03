import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState, Pagination, SkeletonList } from '../../components/ui/index.ts'
import { useMyActivity, useRankingPoints } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL } from '../../lib/format.ts'
import { categoriesOf, rankCategory, type CategoryFilter } from '../../lib/rankings.ts'
import { AccountSection } from './AccountSection.tsx'

interface Standing extends CategoryFilter {
  competitorId: string
  rank: number
  of: number
  points: number
}

// Where the athlete stands in each category they have points in
export function MyRankings({ title = 'My rankings', note = 'Where you stand in each category, by points.' }: { title?: string; note?: string } = {}) {
  const activity = useMyActivity()
  const points = useRankingPoints()

  const standings = useMemo<Standing[]>(() => {
    const all = points.data ?? []
    return (activity.data?.competitorIds ?? [])
      .flatMap((competitorId) =>
        categoriesOf(all, competitorId).flatMap((category) => {
          const rows = rankCategory(all, category)
          const mine = rows.find((r) => r.competitorId === competitorId)
          return mine ? [{ ...category, competitorId, rank: mine.rank, of: rows.length, points: mine.points }] : []
        }),
      )
      .sort((a, b) => a.discipline.localeCompare(b.discipline) || b.points - a.points)
  }, [activity.data, points.data])

  const { page, setPage, pageSize, total, pageItems } = usePagination(standings, 'standings')
  const loading = activity.isLoading || points.isLoading
  const best = standings.reduce<Standing | undefined>((top, s) => (!top || s.rank < top.rank ? s : top), undefined)

  const groups = useMemo(() => {
    const byDiscipline = new Map<string, Standing[]>()
    for (const s of pageItems) byDiscipline.set(s.discipline, [...(byDiscipline.get(s.discipline) ?? []), s])
    return [...byDiscipline]
  }, [pageItems])

  return (
    <AccountSection title={title} note={note}>
      {loading ? (
        <SkeletonList rows={5} />
      ) : standings.length === 0 ? (
        <EmptyState title="Not ranked yet" description="Points appear after a result in a ranked category." />
      ) : (
        <>
          <p className="font-mono text-xs uppercase text-neutral-500">
            {standings.length} {standings.length === 1 ? 'category' : 'categories'}
            {best && (
              <>
                {' '}
                <span aria-hidden>/</span> best rank #{best.rank}
              </>
            )}
          </p>
          <ul aria-label={title} className="flex flex-col gap-8">
            {groups.map(([discipline, rows]) => (
              <li key={discipline} className="flex flex-col gap-3">
                <h3 className="text-body font-semibold tracking-[-0.01em] text-neutral-900">{DISCIPLINE_LABEL[rows[0]!.discipline]}</h3>
                <ol className="border-y border-neutral-200">
                  {rows.map((s) => (
                    <li
                      key={`${s.competitorId}|${s.ageGroup}|${s.class}`}
                      className="group relative grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-5 border-t border-neutral-200 py-3 transition-colors first:border-t-0 hover:bg-gold-50 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-8 sm:px-3"
                    >
                      <span className={cn('text-[1.0625rem] font-semibold leading-none tracking-[-0.02em] tabular-nums', s.rank <= 3 ? 'text-gold-700' : 'text-neutral-700')}>#{s.rank}</span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          to={`/rankings?discipline=${s.discipline}&age=${s.ageGroup}&class=${s.class}&highlight=${s.competitorId}`}
                          className="font-semibold text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500"
                        >
                          {AGE_GROUP_LABEL[s.ageGroup]} <span aria-hidden>/</span> {s.class}
                        </Link>
                        <span className="text-small text-neutral-600">of {s.of} ranked</span>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-[1rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-neutral-900">{s.points}</span>
                          <span className="font-mono text-xs uppercase text-neutral-500">pts</span>
                        </span>
                        <ArrowUpRight aria-hidden className="hidden size-5 text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 sm:block" strokeWidth={1.5} />
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </>
      )}
      {!loading && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="My rankings pagination" />}
    </AccountSection>
  )
}
