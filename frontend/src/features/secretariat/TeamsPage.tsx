import type { Team } from '@bis/shared'
import { ArrowUpRight, Pencil, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useTeams, useCompetitorRows, useDeleteTeam } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { TeamDialog } from './TeamDialog.tsx'
import { TeamMembers } from './TeamMembers.tsx'

export function TeamsPage() {
  const teams = useTeams()
  const competitors = useCompetitorRows()
  const remove = useDeleteTeam()
  // Admins and the secretariat each have their own competitors page
  const section = useAuth((s) => (s.user?.role === 'admin' ? '/admin' : '/secretariat'))
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Team | null>(null)

  if (teams.isError) return <ErrorState onRetry={() => void teams.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (teams.data ?? []).filter((c) => !needle || [c.name, c.contactName].some((v) => v.toLowerCase().includes(needle)))
  const dancers = new Map<string, number>()
  for (const c of competitors.data ?? []) dancers.set(c.teamId, (dancers.get(c.teamId) ?? 0) + 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teams" description="The teams on the entry forms. Dancers are entered under a team." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search teams" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>Add team</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Team>
        loading={teams.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Teams pagination"
        detailTitle={(c) => c.name}
        detailSections={(c) => [{ id: 'competitors', label: 'Competitors', icon: Users, content: <TeamMembers team={c} section={section} /> }]}
        empty={needle ? { title: 'No teams match', description: 'Try a different name.' } : { title: 'No teams yet', description: 'Add the teams named on the entry forms.' }}
        columns={[
          { key: 'name', header: 'Team', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'contact', header: 'Contact person', cell: (c) => c.contactName || '–', muted: true, hideBelow: 'sm' },
          { key: 'phone', header: 'Contact no.', cell: (c) => c.contactPhone || '–', mono: true, muted: true, hideBelow: 'md' },
          {
            key: 'dancers',
            header: 'Competitors',
            mono: true,
            align: 'right',
            cell: (c) => (
              <Link
                to={`${section}/competitors?team=${c.id}`}
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

      <TeamDialog open={editing !== null} team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="This can't be undone. A team with competitors can't be deleted."
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
