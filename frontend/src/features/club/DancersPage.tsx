import type { ClubDancer } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  PageHeader,
  SearchField,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import { useClubDancers, useDeleteDancer } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, competitorName } from '../../lib/format.ts'
import { DancerDialog } from './DancerDialog.tsx'

export function DancersPage() {
  const dancers = useClubDancers()
  const remove = useDeleteDancer()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ClubDancer | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<ClubDancer | null>(null)

  if (dancers.isError) return <ErrorState onRetry={() => void dancers.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (dancers.data ?? []).filter((d) => !needle || competitorName(d.names).toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dancers"
        description="Your club's dancers. We keep only a name and an age group, and nothing else about them."
      />

      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search dancers" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button className="w-full sm:w-auto" onClick={() => setEditing('new')}>
            Add dancer
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<ClubDancer>
        loading={dancers.isLoading}
        rows={rows}
        rowKey={(d) => d.id}
        minWidthClass="min-w-0"
        paginationLabel="Dancers pagination"
        detailTitle={(d) => competitorName(d.names)}
        empty={
          needle
            ? { title: 'No dancers match' }
            : { title: 'No dancers yet', description: 'Add your first dancer, then register them to events.' }
        }
        columns={[
          { key: 'name', header: 'Dancer', cell: (d) => <span className="font-medium">{competitorName(d.names)}</span> },
          { key: 'type', header: 'Type', cell: (d) => (d.names.length === 1 ? 'Solo' : 'Couple'), muted: true, hideBelow: 'sm' },
          { key: 'age', header: 'Age group', cell: (d) => (d.ageGroup ? AGE_GROUP_LABEL[d.ageGroup] : '–'), muted: true },
          { key: 'entries', header: 'Entries', cell: (d) => d.entryCount, mono: true, align: 'right' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (d) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label={`Edit ${competitorName(d.names)}`} onClick={() => setEditing(d)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${competitorName(d.names)}`} onClick={() => setToDelete(d)} />
              </div>
            ),
          },
        ]}
      />

      <DancerDialog open={editing !== null} dancer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete ? competitorName(toDelete.names) : ''}?`}
        description="This can't be undone. A dancer with entries can't be deleted."
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
    </div>
  )
}
