import { membershipLabel, type Coach } from '@bis/shared'
import { formatDate } from '../../lib/format.ts'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, IconButton, PageHeader, SearchField, Table, Toolbar, ToolbarActions } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import { useCoaches, useCompetitorRows, useDeleteCoach } from '../../hooks/index.ts'
import { CoachDialog } from './CoachDialog.tsx'

export function CoachesPage() {
  const coaches = useCoaches()
  const competitors = useCompetitorRows()
  const remove = useDeleteCoach()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Coach | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Coach | null>(null)

  if (coaches.isError) return <ErrorState onRetry={() => void coaches.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (coaches.data ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle))
  const teams = new Map<string, number>()
  for (const c of competitors.data ?? []) {
    const id = c.details?.coachId
    if (id) teams.set(id, (teams.get(id) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Coaches" description="Each coach, with the year their membership and the Coaches Summit were paid." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search coaches" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>Add coach</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Coach>
        loading={coaches.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Coaches pagination"
        detailTitle={(c) => c.name}
        empty={needle ? { title: 'No coaches match', description: 'Try a different name.' } : { title: 'No coaches yet', description: 'Add the coaches named on the entry forms.' }}
        columns={[
          { key: 'name', header: 'Coach', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'id', header: 'Membership ID', cell: (c) => c.membershipId ?? '–', mono: true, muted: true, hideBelow: 'sm' },
          { key: 'phone', header: 'Contact no.', cell: (c) => c.phone || '–', mono: true, muted: true, hideBelow: 'md' },
          { key: 'teams', header: 'Competitors', cell: (c) => teams.get(c.id) ?? 0, mono: true, align: 'right', hideBelow: 'sm' },
          { key: 'member', header: 'Membership', cell: (c) => membershipLabel(c.memberYear, new Date().getFullYear()), mono: true, muted: true },
          { key: 'summit', header: 'Summit', cell: (c) => c.summitYear ?? 'Not paid', mono: true, muted: true, hideBelow: 'md' },
          { key: 'attended', header: 'Attended', cell: (c) => (c.summits?.length ? `${c.summits.length} (last ${formatDate(c.summits[0]!)})` : '–'), mono: true, muted: true, hideBelow: 'lg' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${c.name}`} onClick={() => setToDelete(c)} />
              </div>
            ),
          },
        ]}
      />

      <CoachDialog open={editing !== null} coach={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <DeleteDialog kind="coach" target={toDelete ? { id: toDelete.id, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
