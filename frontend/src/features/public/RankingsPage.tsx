import { AgeGroup, Class, Discipline, type Club, type Competitor } from '@bis/shared'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { ErrorState, PageHeader, SearchField, Select, Table, Toolbar } from '../../components/ui/index.ts'
import { useClubs, useCompetitors, useRankingPoints } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, competitorName, eventGrade } from '../../lib/format.ts'
import { availableClasses, rankCategory, type RankingRow } from '../../lib/rankings.ts'
import { cn } from '../../lib/cn.ts'

interface Row extends RankingRow {
  competitor: Competitor
  club: Club | undefined
}

const DISCIPLINES = Object.values(Discipline).map((id) => ({ id, label: DISCIPLINE_LABEL[id] }))
const AGE_GROUPS = Object.values(AgeGroup).map((id) => ({ id, label: AGE_GROUP_LABEL[id] }))

function parse<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback
}

export function RankingsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const points = useRankingPoints()
  const competitors = useCompetitors()
  const clubs = useClubs()

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
    const clubById = new Map((clubs.data ?? []).map((c) => [c.id, c]))
    return rankCategory(points.data ?? [], { ageGroup, class: cls, discipline }).flatMap((row) => {
      const competitor = competitorById.get(row.competitorId)
      return competitor ? [{ ...row, competitor, club: clubById.get(competitor.clubId) }] : []
    })
  }, [points.data, competitors.data, clubs.data, ageGroup, cls, discipline])

  const needle = query.trim().toLowerCase()
  // The table pages through the result, 10 rows at a time, and returns to page 1 when this changes
  const visible = needle
    ? ranked.filter(
        (r) =>
          competitorName(r.competitor.names).toLowerCase().includes(needle) ||
          r.club?.name.toLowerCase().includes(needle),
      )
    : ranked

  if (points.isError || competitors.isError || clubs.isError) {
    return (
      <ErrorState
        onRetry={() => void Promise.all([points.refetch(), competitors.refetch(), clubs.refetch()])}
      />
    )
  }

  const loading = points.isLoading || competitors.isLoading || clubs.isLoading

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Rankings" description="Standings by age group, class and discipline." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" value={query} onChange={setQuery} />
        <div className="w-[calc(50%-0.375rem)] sm:w-36">
          <Select label="Discipline" value={discipline} onChange={(e) => set('discipline')(e.target.value)}>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-40">
          <Select label="Age group" value={ageGroup} onChange={(e) => set('age')(e.target.value)}>
            {AGE_GROUPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-28">
          <Select label="Class" value={cls} onChange={(e) => set('class')(e.target.value)}>
            {(classes.length ? classes : [Class.E1]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Toolbar>

      <section aria-labelledby="category" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="category" className="text-title font-semibold">
            {eventGrade({ ageGroup, class: cls, discipline })}
          </h2>
          <p className="text-small text-neutral-600">
            <span className="font-mono tabular-nums text-neutral-900">{ranked.length}</span> ranked
          </p>
        </div>

        <Table<Row>
          loading={loading}
          rows={visible}
          rowKey={(r) => r.competitorId}
          minWidthClass="min-w-0"
          onRowClick={(r) => navigate(`/competitors/${r.competitorId}`)}
          empty={
            needle
              ? { title: `No competitors match "${query.trim()}"`, description: 'Try a different name or club.' }
              : {
                  title: 'No rankings in this category yet',
                  description: 'Points appear here once results from this category are approved.',
                }
          }
          columns={[
            {
              key: 'rank',
              header: 'Rank',
              widthClass: 'w-20',
              mono: true,
              cell: (r) => (
                <span className={cn(r.rank <= 3 ? 'font-semibold text-neutral-900' : 'text-neutral-500')}>
                  {r.rank}
                </span>
              ),
            },
            {
              key: 'competitor',
              header: 'Competitor',
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <Avatars names={r.competitor.names} />
                  <div className="flex min-w-0 flex-col">
                    <Link
                      to={`/competitors/${r.competitorId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-neutral-900 hover:underline"
                    >
                      {competitorName(r.competitor.names)}
                    </Link>
                    <span className="truncate text-neutral-600">{r.club?.name}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'competitions',
              header: 'Competitions',
              align: 'right',
              mono: true,
              muted: true,
              hideBelow: 'sm',
              cell: (r) => r.competitions,
            },
            {
              key: 'points',
              header: 'Points',
              align: 'right',
              mono: true,
              cell: (r) => <span className="font-semibold">{r.points}</span>,
            },
          ]}
          paginationLabel="Rankings pagination"
        />
      </section>
    </div>
  )
}
