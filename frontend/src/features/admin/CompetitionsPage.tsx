import type { Competition } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { useCompetitions, useDeleteCompetition, useEvents } from '../../hooks/index.ts'
import { dateParts, formatDate } from '../../lib/format.ts'
import { CompetitionDialog } from './CompetitionDialog.tsx'

export function CompetitionsPage() {
  const competitions = useCompetitions()
  const events = useEvents()
  const remove = useDeleteCompetition()
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')
  const [toDelete, setToDelete] = useState<Competition | null>(null)
  // The competition being edited, or 'new' while creating one
  const [editing, setEditing] = useState<Competition | 'new' | null>(null)

  const all = useMemo(
    () => [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [competitions.data],
  )

  if (competitions.isError) return <ErrorState onRetry={() => void competitions.refetch()} />

  const years = [...new Set(all.map((c) => dateParts(c.date).year))]
  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (c) =>
      (year === 'all' || dateParts(c.date).year === year) &&
      (!needle || [c.name, c.venue, c.organizer].some((v) => v.toLowerCase().includes(needle))),
  )
  const eventCount = (id: string) => events.data?.filter((e) => e.competitionId === id).length

  function confirmDelete(competition: Competition) {
    remove.mutate(competition.id, {
      onSuccess: () => {
        setToDelete(null)
        toast.success(`Deleted ${competition.name}`)
      },
      onError: (e) => {
        setToDelete(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Competitions" description="Create and edit the competitions BIS runs." />

      <Toolbar>
        <SearchField className="w-full sm:w-72" value={query} onChange={setQuery} />
        <div className="w-full sm:w-44">
          <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarActions>
          <Button className="w-full sm:w-auto" onClick={() => setEditing('new')}>
            New competition
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Competition>
        loading={competitions.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Competitions pagination"
        detailTitle={(c) => c.name}
        empty={
          needle || year !== 'all'
            ? { title: 'No competitions match', description: 'Try a different year, name, venue or organizer.' }
            : { title: 'No competitions yet', description: 'Create the first one to start taking entries.' }
        }
        columns={[
          {
            key: 'name',
            header: 'Competition',
            cell: (c) => (
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-neutral-900">{c.name}</span>
                <span className="truncate text-small text-neutral-600">{c.venue}</span>
              </div>
            ),
          },
          { key: 'date', header: 'Date', cell: (c) => formatDate(c.date) },
          { key: 'organizer', header: 'Organizer', cell: (c) => c.organizer, muted: true, hideBelow: 'md' },
          {
            key: 'events',
            header: 'Events',
            cell: (c) => eventCount(c.id) ?? '–',
            mono: true,
            align: 'right',
            hideBelow: 'sm',
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${c.name}`} onClick={() => setToDelete(c)} />
              </div>
            ),
          },
        ]}
      />

      <CompetitionDialog
        open={editing !== null}
        competition={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="This can't be undone. A competition that already has events can't be deleted."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => toDelete && confirmDelete(toDelete)}>
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />
    </div>
  )
}
