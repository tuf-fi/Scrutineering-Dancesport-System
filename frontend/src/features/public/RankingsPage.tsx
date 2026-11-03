import { AgeGroup, Class, Discipline, type Team, type Competitor } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { EmptyState, ErrorState, Pagination, SearchField, Select, Skeleton } from '../../components/ui/index.ts'
import { useTeams, useCompetitors, useRankingPoints } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { useRevealRow } from '../../hooks/useRevealRow.ts'
import { HeaderStat, HeaderStats, PublicHeader } from './PublicHeader.tsx'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, competitorName, eventGrade } from '../../lib/format.ts'
import { availableClasses, rankCategory, type RankingRow } from '../../lib/rankings.ts'
import { cn } from '../../lib/cn.ts'

interface Row extends RankingRow {
  competitor: Competitor
  team: Team | undefined
}

const DISCIPLINES = Object.values(Discipline).map((id) => ({
  id,
  label: DISCIPLINE_LABEL[id],
}))
const AGE_GROUPS = Object.values(AgeGroup).map((id) => ({
  id,
  label: AGE_GROUP_LABEL[id],
}))

function parse<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback
}

export function RankingsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const points = useRankingPoints()
  const competitors = useCompetitors()
  const teams = useTeams()

  const classes = useMemo(() => availableClasses(points.data ?? []), [points.data])
  const discipline = parse(params.get('discipline'), Object.values(Discipline), Discipline.Latin)
  const ageGroup = parse(params.get('age'), Object.values(AgeGroup), AgeGroup.Junior1)
  const cls = parse(params.get('class'), classes.length ? classes : [Class.E1], Class.E1)

  const set = (key: string) => (value: string) =>
    setParams(
      (p) => {
        p.set(key, value)
        return p
      },
      { replace: true },
    )

  const ranked = useMemo<Row[]>(() => {
    const competitorById = new Map((competitors.data ?? []).map((c) => [c.id, c]))
    const teamById = new Map((teams.data ?? []).map((c) => [c.id, c]))
    return rankCategory(points.data ?? [], {
      ageGroup,
      class: cls,
      discipline,
    }).flatMap((row) => {
      const competitor = competitorById.get(row.competitorId)
      return competitor ? [{ ...row, competitor, team: teamById.get(competitor.teamId) }] : []
    })
  }, [points.data, competitors.data, teams.data, ageGroup, cls, discipline])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? ranked.filter(
        (r) =>
          competitorName(r.competitor.names).toLowerCase().includes(needle) ||
          r.team?.name.toLowerCase().includes(needle),
      )
    : ranked
  const { page, setPage, pageSize, total, pageItems } = usePagination(
    visible,
    `${discipline}|${ageGroup}|${cls}|${needle}`,
  )

  const loading = points.isLoading || competitors.isLoading || teams.isLoading
  const revealed = useRevealRow(visible, (r) => r.competitorId, pageSize, setPage, !loading)

  if (points.isError || competitors.isError || teams.isError) {
    return <ErrorState onRetry={() => void Promise.all([points.refetch(), competitors.refetch(), teams.refetch()])} />
  }

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        title="Rankings"
        eyebrow="Season standings"
        description="Points from every approved result, by discipline, age group and class. Open a name for their full record."
        aside={
          <HeaderStats>
            <HeaderStat value={loading ? '–' : ranked.length} label="Ranked" />
            <HeaderStat value={cls} label="Class" />
          </HeaderStats>
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] sm:gap-x-4">
        <SearchField className="col-span-2 sm:col-span-1" value={query} onChange={setQuery} />
        <Select label="Discipline" value={discipline} onChange={(e) => set('discipline')(e.target.value)}>
          {DISCIPLINES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select label="Age group" value={ageGroup} onChange={(e) => set('age')(e.target.value)}>
          {AGE_GROUPS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
        <Select label="Class" value={cls} onChange={(e) => set('class')(e.target.value)}>
          {(classes.length ? classes : [Class.E1]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <section aria-labelledby="category" className="flex flex-col gap-4">
        <h2 id="category" className="text-small font-bold uppercase tracking-wide text-neutral-900">
          {eventGrade({ ageGroup, class: cls, discipline })}
        </h2>

        {loading ? (
          <RankSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            title={needle ? `No competitors match "${query.trim()}"` : 'No rankings in this category yet'}
            description={
              needle
                ? 'Try a different name or team.'
                : 'Points appear here once results from this category are approved.'
            }
          />
        ) : (
          <ol aria-label="Rankings" className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
            {pageItems.map((r) => (
              <li
                key={r.competitorId}
                data-row={r.competitorId}
                className={cn('group relative grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 py-4 transition-colors duration-700 hover:bg-gold-50 sm:grid-cols-[3rem_1fr_auto] sm:gap-x-8 sm:px-4 sm:py-5', revealed === r.competitorId && 'bg-gold-50')}
              >
                <span
                  className={cn(
                    'font-mono text-small font-medium leading-none tabular-nums',
                    r.rank <= 3 ? 'text-gold-700' : 'text-neutral-400',
                  )}
                >
                  {String(r.rank).padStart(2, '0')}
                </span>

                <div className="flex min-w-0 items-center gap-3">
                  <Avatars names={r.competitor.names} />
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to={`/competitors/${r.competitorId}`}
                      state={{ from: 'rankings' }}
                      className="truncate font-semibold text-neutral-900 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-gold-500"
                    >
                      {competitorName(r.competitor.names)}
                    </Link>
                    <span className="truncate text-small text-neutral-600">{r.team?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-baseline gap-4 whitespace-nowrap sm:gap-6">
                    <span className="hidden font-mono text-xs uppercase tabular-nums text-neutral-600 sm:inline">
                      {r.competitions} {r.competitions === 1 ? 'comp' : 'comps'}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[1.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-neutral-900">
                        {r.points}
                      </span>
                      <span className="font-mono text-xs uppercase text-neutral-600">pts</span>
                    </span>
                  </div>
                  <ArrowUpRight
                    aria-hidden
                    className="hidden size-6 text-neutral-400 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500 sm:block"
                    strokeWidth={1.5}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}

        {!loading && total > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            label="Rankings pagination"
          />
        )}
      </section>
    </div>
  )
}

function RankSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 py-4 sm:grid-cols-[3rem_1fr_auto] sm:gap-x-8 sm:px-4 sm:py-5"
        >
          <Skeleton className="h-8 w-9" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-8 w-14" />
        </div>
      ))}
    </div>
  )
}
