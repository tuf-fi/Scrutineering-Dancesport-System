import type { CompetitorRow } from '@bis/shared'
import { Hash, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import {
  useAssignBackNumbers,
  useClubs,
  useCompetitionEntries,
  useCompetitions,
  useCompetitorRows,
  useDeleteCompetitor,
  useEvents,
} from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances } from '../../lib/format.ts'
import { BackNumberDialog } from './BackNumberDialog.tsx'
import { CompetitorDialog } from './CompetitorDialog.tsx'
import { ImportDialog } from './ImportDialog.tsx'

export function CompetitorsPage() {
  const competitors = useCompetitorRows()
  const clubs = useClubs()
  const competitions = useCompetitions()
  const assign = useAssignBackNumbers()
  const [competitionId, setCompetitionId] = useState('all')
  const [eventId, setEventId] = useState('all')
  const [query, setQuery] = useState('')
  const [clubId, setClubId] = useState('all')
  // The competitor being edited, or 'new' while adding one
  const [editing, setEditing] = useState<CompetitorRow | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<CompetitorRow | null>(null)
  const remove = useDeleteCompetitor()
  const [importing, setImporting] = useState(false)
  const [numbering, setNumbering] = useState<CompetitorRow | null>(null)
  const scoped = competitionId !== 'all'
  const events = useEvents(scoped ? competitionId : undefined)
  const entries = useCompetitionEntries(scoped ? competitionId : '')

  if (competitors.isError) return <ErrorState onRetry={() => void competitors.refetch()} />

  const all = competitors.data ?? []
  const missing = all.filter((c) => c.backNumber === null).length
  const needle = query.trim().toLowerCase()

  // With a competition (and event) chosen, only the dancers entered in it show, with what they are entered in
  const eventNumber = new Map((events.data ?? []).map((e) => [e.id, e.number]))
  const enteredIn = new Map<string, number[]>()
  if (scoped) {
    for (const e of entries.data ?? []) {
      if (e.scratched || (eventId !== 'all' && e.eventId !== eventId)) continue
      enteredIn.set(e.competitorId, [...(enteredIn.get(e.competitorId) ?? []), eventNumber.get(e.eventId) ?? 0])
    }
  }

  const rows = all
    .filter(
      (c) =>
        (!scoped || enteredIn.has(c.id)) &&
        (clubId === 'all' || c.clubId === clubId) &&
        (!needle ||
          competitorName(c.names).toLowerCase().includes(needle) ||
          c.clubName.toLowerCase().includes(needle) ||
          String(c.backNumber) === needle),
    )
    .map((c) => ({ ...c, entryCount: scoped ? (enteredIn.get(c.id)?.length ?? 0) : c.entryCount }))

  function assignAll() {
    assign.mutate(undefined, {
      onSuccess: (n) => toast.success(`Assigned ${n} back number${n === 1 ? '' : 's'}`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Competitors" description="Everyone who can be entered, with their back numbers." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search competitors" value={query} onChange={setQuery} />
        <div className="w-full sm:w-56">
          <Select
            label="Competition"
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value)
              setEventId('all')
            }}
          >
            <option value="all">All competitors</option>
            {[...(competitions.data ?? [])]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
        {scoped && (
          <div className="w-full sm:w-56">
            <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">All events</option>
              {[...(events.data ?? [])]
                .sort((a, b) => a.number - b.number)
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {eventCode(ev)} {eventDances(ev)}
                  </option>
                ))}
            </Select>
          </div>
        )}
        <div className="w-full sm:w-44">
          <Select label="Club" value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="all">All clubs</option>
            {(clubs.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarActions>
          {missing > 0 && (
            <Button variant="secondary" disabled={assign.isPending} onClick={assignAll}>
              {`Assign ${missing} back number${missing === 1 ? '' : 's'}`}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Button onClick={() => setEditing('new')}>Add competitor</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<CompetitorRow>
        loading={competitors.isLoading || (scoped && (entries.isLoading || events.isLoading))}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Competitors pagination"
        detailTitle={(c) => competitorName(c.names)}
        empty={
          needle || clubId !== 'all' || scoped
            ? { title: 'No competitors match', description: 'Try a different event, name, number or club.' }
            : { title: 'No competitors yet', description: 'Add one, or import a CSV.' }
        }
        columns={[
          { key: 'back', header: 'Back no.', cell: (c) => c.backNumber ?? '–', mono: true, widthClass: 'w-28' },
          { key: 'who', header: 'Competitor', cell: (c) => <span className="font-medium">{competitorName(c.names)}</span> },
          { key: 'club', header: 'Club', cell: (c) => c.clubName, muted: true, hideBelow: 'md' },
          ...(scoped
            ? [
            {
              key: 'events',
              header: 'Events',
              cell: (c: CompetitorRow) =>
                (enteredIn.get(c.id) ?? [])
                  .sort((a, b) => a - b)
                  .map((n) => eventCode({ number: n }))
                  .join(', ') || '–',
              mono: true,
              muted: true,
              hideBelow: 'md' as const,
            },
              ]
            : []),
          { key: 'entries', header: 'Entries', cell: (c) => c.entryCount, mono: true, align: 'right', hideBelow: 'sm' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-28',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label={`Edit ${competitorName(c.names)}`} onClick={() => setEditing(c)} />
                <IconButton icon={Hash} label={`Set back number for ${competitorName(c.names)}`} onClick={() => setNumbering(c)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${competitorName(c.names)}`} onClick={() => setToDelete(c)} />
              </div>
            ),
          },
        ]}
      />

      <CompetitorDialog
        open={editing !== null}
        competitor={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete ? competitorName(toDelete.names) : ''}?`}
        description="This can't be undone. A competitor with entries can't be deleted."
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
                    toast.success(`Deleted ${competitorName(toDelete.names)}`)
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
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
      <BackNumberDialog competitor={numbering} onClose={() => setNumbering(null)} />
    </div>
  )
}
