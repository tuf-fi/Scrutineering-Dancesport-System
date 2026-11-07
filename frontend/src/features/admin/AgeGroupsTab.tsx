import type { AgeGroupDef } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, IconButton, SearchField, Table, Toolbar, ToolbarActions } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import { useCatalog, useDeleteAgeGroup, useEvents } from '../../hooks/index.ts'
import { AgeGroupDialog } from './AgeGroupDialog.tsx'

export function AgeGroupsTab() {
  const { ageGroups, isLoading, isError, refetch } = useCatalog()
  const events = useEvents()
  const remove = useDeleteAgeGroup()
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<AgeGroupDef | null>(null)
  // The age group being edited, or 'new' while adding one
  const [editing, setEditing] = useState<AgeGroupDef | 'new' | null>(null)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  // The ages a group covers: above the group before it, up to its own oldest age
  const ages = (group: AgeGroupDef) => {
    const before = ageGroups[ageGroups.indexOf(group) - 1]?.oldestAge
    const from = before == null ? null : before + 1
    if (group.oldestAge === null) return from === null ? 'All ages' : `${from} and over`
    return from === null ? `Up to ${group.oldestAge}` : `${from} to ${group.oldestAge}`
  }
  const needle = query.trim().toLowerCase()
  const rows = ageGroups.filter((g) => !needle || [g.name, g.short].some((v) => v.toLowerCase().includes(needle)))
  const eventCount = (id: string) => events.data?.filter((e) => e.ageGroup === id).length


  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search age groups" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>New age group</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<AgeGroupDef>
        loading={isLoading}
        rows={rows}
        rowKey={(g) => g.id}
        minWidthClass="min-w-0"
        paginationLabel="Age groups pagination"
        detailTitle={(g) => g.name}
        empty={needle ? { title: 'No age groups match', description: 'Try a different name.' } : { title: 'No age groups yet', description: 'Add one so events can be created.' }}
        columns={[
          { key: 'name', header: 'Age group', cell: (g) => <span className="font-medium text-neutral-900">{g.name}</span> },
          { key: 'short', header: 'Printed as', cell: (g) => g.short, mono: true, hideBelow: 'sm' },
          { key: 'ages', header: 'Ages', cell: ages, mono: true },
          { key: 'fee', header: 'Price', cell: (g) => (g.juvenileFee ? 'Juvenile' : 'Standard'), muted: true, hideBelow: 'md' },
          { key: 'events', header: 'Events', cell: (g) => eventCount(g.id) ?? '–', mono: true, align: 'right', hideBelow: 'sm' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (g) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Edit ${g.name}`} onClick={() => setEditing(g)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${g.name}`} onClick={() => setToDelete(g)} />
              </div>
            ),
          },
        ]}
      />

      <AgeGroupDialog open={editing !== null} group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

      <DeleteDialog kind="ageGroup" target={toDelete ? { id: toDelete.id, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
