import type { Club } from '@bis/shared'
import { ArrowUpRight, Pencil, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useClubs, useCompetitorRows, useDeleteClub } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { ClubDialog } from './ClubDialog.tsx'
import { ClubMembers } from './ClubMembers.tsx'

export function ClubsPage() {
  const clubs = useClubs()
  const competitors = useCompetitorRows()
  const remove = useDeleteClub()
  // Admins and the secretariat each have their own competitors page
  const section = useAuth((s) => (s.user?.role === 'admin' ? '/admin' : '/secretariat'))
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Club | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Club | null>(null)

  if (clubs.isError) return <ErrorState onRetry={() => void clubs.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (clubs.data ?? []).filter((c) => !needle || [c.name, c.contactName].some((v) => v.toLowerCase().includes(needle)))
  const dancers = new Map<string, number>()
  for (const c of competitors.data ?? []) dancers.set(c.clubId, (dancers.get(c.clubId) ?? 0) + 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs" description="The teams on the entry forms. Dancers are entered under a club." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search clubs" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>Add club</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Club>
        loading={clubs.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Clubs pagination"
        detailTitle={(c) => c.name}
        detailSections={(c) => [{ id: 'competitors', label: 'Competitors', icon: Users, content: <ClubMembers club={c} section={section} /> }]}
        empty={needle ? { title: 'No clubs match', description: 'Try a different name.' } : { title: 'No clubs yet', description: 'Add the clubs named on the entry forms.' }}
        columns={[
          { key: 'name', header: 'Club', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'contact', header: 'Contact person', cell: (c) => c.contactName || '–', muted: true, hideBelow: 'sm' },
          { key: 'phone', header: 'Contact no.', cell: (c) => c.contactPhone || '–', mono: true, muted: true, hideBelow: 'md' },
          {
            key: 'dancers',
            header: 'Competitors',
            mono: true,
            align: 'right',
            cell: (c) => (
              <Link
                to={`${section}/competitors?club=${c.id}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${dancers.get(c.id) ?? 0} competitors of ${c.name}`}
                className="group/count inline-flex items-center gap-1.5 text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-gold-500 focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                {dancers.get(c.id) ?? 0}
                <ArrowUpRight aria-hidden className="size-3.5 text-neutral-400 transition duration-300 group-hover/count:rotate-45 group-hover/count:text-gold-500" strokeWidth={1.75} />
              </Link>
            ),
          },
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

      <ClubDialog open={editing !== null} club={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="This can't be undone. A club with competitors can't be deleted."
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
                    toast.success(`Deleted ${toDelete.name}`)
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
