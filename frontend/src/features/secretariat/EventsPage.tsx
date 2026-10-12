import { AgeGroup, type Event } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  PageHeader,
  SearchField,
  Select,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import { useCompetitionEntries, useDeleteEvent, useEvents } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { EventDialog } from './EventDialog.tsx'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

export function EventsPage() {
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)
  const events = useEvents(competitionId)
  const entries = useCompetitionEntries(competitionId ?? '')
  const [query, setQuery] = useState('')
  const [ageGroup, setAgeGroup] = useState('all')
  // The event being edited, or 'new' while adding one
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Event | null>(null)
  const remove = useDeleteEvent()

  // Entries that still count: scratched ones are out
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries.data ?? []) if (!e.scratched) map.set(e.eventId, (map.get(e.eventId) ?? 0) + 1)
    return map
  }, [entries.data])

  if (events.isError) return <ErrorState onRetry={() => void events.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = [...(events.data ?? [])]
    .sort((a, b) => a.number - b.number)
    .filter(
      (e) =>
        (ageGroup === 'all' || e.ageGroup === ageGroup) &&
        (!needle || `${eventCode(e)} ${eventDances(e)} ${DISCIPLINE_LABEL[e.discipline]} ${e.class}`.toLowerCase().includes(needle)),
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Events" description="Every event in the competition, with how many entries it has." />

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
        <CompetitionSelect list={list} value={competitionId} onChange={setChosen} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>Add event</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Event>
        loading={events.isLoading || !competitionId}
        rows={rows}
        rowKey={(e) => e.id}
        minWidthClass="min-w-0"
        paginationLabel="Events pagination"
        detailTitle={(e) => `${eventCode(e)} ${eventDances(e)}`}
        empty={{ title: 'No events match', description: 'Try a different age group or search.' }}
        columns={[
          {
            key: 'number',
            header: 'Event',
            cell: (e) => (
              <Link to={`/secretariat/events/${e.id}`} className="font-medium text-neutral-900 hover:underline">
                {eventCode(e)}
              </Link>
            ),
            mono: true,
          },
          { key: 'dances', header: 'Dances', cell: (e) => eventDances(e) },
          { key: 'age', header: 'Age group', cell: (e) => AGE_GROUP_LABEL[e.ageGroup], muted: true, hideBelow: 'sm' },
          { key: 'class', header: 'Class', cell: (e) => e.class, muted: true, hideBelow: 'md' },
          { key: 'discipline', header: 'Discipline', cell: (e) => DISCIPLINE_LABEL[e.discipline], muted: true, hideBelow: 'md' },
          { key: 'type', header: 'Type', cell: (e) => (e.isSolo ? 'Solo' : 'Couple'), muted: true, hideBelow: 'sm' },
          { key: 'entries', header: 'Entries', cell: (e) => counts.get(e.id) ?? 0, mono: true, align: 'right' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (e) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label={`Edit ${eventCode(e)}`} onClick={() => setEditing(e)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${eventCode(e)}`} onClick={() => setToDelete(e)} />
              </div>
            ),
          },
        ]}
      />

      {competitionId && (
        <EventDialog
          open={editing !== null}
          competitionId={competitionId}
          event={editing === 'new' ? null : editing}
          nextNumber={Math.max(0, ...(events.data ?? []).map((e) => e.number)) + 1}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete ? eventCode(toDelete) : ''}?`}
        description="This can't be undone. An event that has entries or rounds can't be deleted."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                toDelete &&
                remove.mutate(toDelete.id, {
                  onSuccess: () => {
                    toast.success(`Deleted ${eventCode(toDelete)}`)
                    setToDelete(null)
                  },
                  onError: (e) => {
                    setToDelete(null)
                    toast.error(e.message)
                  },
                })
              }
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />
    </div>
  )
}
