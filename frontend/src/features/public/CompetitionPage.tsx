import { AgeGroup, type Event } from '@bis/shared'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorState, PageHeader, SearchField, Select, Skeleton, Table, Toolbar } from '../../components/ui/index.ts'
import { useCompetition, useEvents, useResultEventIds } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, eventCode, eventDances, formatDate } from '../../lib/format.ts'

// One competition's events; the ones with results link to them
export function CompetitionPage() {
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const events = useEvents(competitionId)
  const withResults = useResultEventIds(competitionId)
  const [query, setQuery] = useState('')
  const [ageGroup, setAgeGroup] = useState('all')

  if (competition.isError || events.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), events.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const needle = query.trim().toLowerCase()
  const rows = [...(events.data ?? [])]
    .sort((a, b) => a.number - b.number)
    .filter(
      (e) =>
        (ageGroup === 'all' || e.ageGroup === ageGroup) &&
        (!needle || `${eventCode(e)} ${eventDances(e)} ${DISCIPLINE_LABEL[e.discipline]} ${e.class}`.toLowerCase().includes(needle)),
    )

  return (
    <div className="flex flex-col gap-8">
      <Link to="/competitions" className="w-fit text-small text-neutral-600 hover:text-neutral-900">
        All competitions
      </Link>
      <PageHeader
        title={competition.data.name}
        description={`${formatDate(competition.data.date)} · ${competition.data.venue}`}
      />

      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search events" value={query} onChange={setQuery} />
        <div className="w-full sm:w-52">
          <Select label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="all">All age groups</option>
            {Object.values(AgeGroup).map((a) => (
              <option key={a} value={a}>
                {AGE_GROUP_LABEL[a]}
              </option>
            ))}
          </Select>
        </div>
      </Toolbar>

      <Table<Event>
        loading={events.isLoading || withResults.isLoading}
        rows={rows}
        rowKey={(e) => e.id}
        minWidthClass="min-w-0"
        paginationLabel="Events pagination"
        detailTitle={(e) => `${eventCode(e)} ${eventDances(e)}`}
        empty={{ title: 'No events match', description: 'Try a different age group or search.' }}
        columns={[
          {
            key: 'event',
            header: 'Event',
            cell: (e) =>
              withResults.data?.includes(e.id) ? (
                <Link to={`/competitions/${competitionId}/events/${e.id}`} className="font-medium text-neutral-900 hover:underline">
                  <span className="mr-2 font-mono tabular-nums text-neutral-500">{eventCode(e)}</span>
                  {eventDances(e)}
                </Link>
              ) : (
                <span className="text-neutral-900">
                  <span className="mr-2 font-mono tabular-nums text-neutral-500">{eventCode(e)}</span>
                  {eventDances(e)}
                </span>
              ),
          },
          { key: 'age', header: 'Age group', cell: (e) => AGE_GROUP_LABEL[e.ageGroup], muted: true, hideBelow: 'sm' },
          { key: 'class', header: 'Class', cell: (e) => e.class, muted: true, hideBelow: 'md' },
          { key: 'discipline', header: 'Discipline', cell: (e) => DISCIPLINE_LABEL[e.discipline], muted: true, hideBelow: 'md' },
          {
            key: 'results',
            header: 'Results',
            align: 'right',
            cell: (e) => (withResults.data?.includes(e.id) ? 'Published' : 'Not yet'),
            muted: true,
          },
        ]}
      />
    </div>
  )
}
