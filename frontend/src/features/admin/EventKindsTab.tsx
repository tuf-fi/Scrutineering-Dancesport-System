import { KIND_FIELD_LABEL, type EventKindDef } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, IconButton, SearchField, Table, Toolbar, ToolbarActions } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import { useCatalog, useDeleteEventKind, useEvents } from '../../hooks/index.ts'
import { FEE_MODE_LABEL } from '../../lib/format.ts'
import { EventKindDialog } from './EventKindDialog.tsx'

// What a kind asks of an entry, in a line
const rules = (k: EventKindDef) =>
  [
    k.beginnersOnly && 'Beginners only',
    k.closedToProvince && 'Closed to one province',
    k.requires.length > 0 && `Needs ${k.requires.map((f) => KIND_FIELD_LABEL[f]).join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ') || '–'

export function EventKindsTab() {
  const { kinds, isLoading, isError, refetch } = useCatalog()
  const events = useEvents()
  const remove = useDeleteEventKind()
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<EventKindDef | null>(null)
  // The kind being edited, or 'new' while adding one
  const [editing, setEditing] = useState<EventKindDef | 'new' | null>(null)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = kinds.filter((k) => !needle || k.name.toLowerCase().includes(needle))
  const eventCount = (id: string) => events.data?.filter((e) => (e.kind ?? 'standard') === id).length


  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search kinds" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>New kind</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<EventKindDef>
        loading={isLoading}
        rows={rows}
        rowKey={(k) => k.id}
        minWidthClass="min-w-0"
        paginationLabel="Kinds pagination"
        detailTitle={(k) => k.name}
        empty={needle ? { title: 'No kinds match', description: 'Try a different name.' } : { title: 'No kinds yet', description: 'Add one so events can be created.' }}
        columns={[
          { key: 'name', header: 'Kind', cell: (k) => <span className="font-medium text-neutral-900">{k.name}</span> },
          { key: 'fee', header: 'Price', cell: (k) => FEE_MODE_LABEL[k.feeMode], muted: true, hideBelow: 'sm' },
          { key: 'rules', header: 'Rules', cell: rules, muted: true, hideBelow: 'md' },
          { key: 'events', header: 'Events', cell: (k) => eventCount(k.id) ?? '–', mono: true, align: 'right', hideBelow: 'sm' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (k) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Edit ${k.name}`} onClick={() => setEditing(k)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${k.name}`} onClick={() => setToDelete(k)} />
              </div>
            ),
          },
        ]}
      />

      <EventKindDialog open={editing !== null} kind={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

      <DeleteDialog kind="eventKind" target={toDelete ? { id: toDelete.id, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
