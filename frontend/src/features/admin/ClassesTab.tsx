import type { ClassDef } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, ErrorState, IconButton, SearchField, Select, Table, Toolbar, ToolbarActions } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import { useCatalog, useCompetitions, useDeleteClass, useEvents } from '../../hooks/index.ts'
import { eventCode, eventDances } from '../../lib/format.ts'
import { ClassDialog } from './ClassDialog.tsx'

const SHOWN = 5

export function ClassesTab() {
  const { classes, isLoading, isError, refetch } = useCatalog()
  const events = useEvents()
  const competitions = useCompetitions()
  const remove = useDeleteClass()
  const [query, setQuery] = useState('')
  const [competitionId, setCompetitionId] = useState('all')
  const [toDelete, setToDelete] = useState<ClassDef | null>(null)
  // The class being renamed, or 'new' while adding one
  const [editing, setEditing] = useState<ClassDef | 'new' | null>(null)

  // Newest competition first, as the other pickers list them
  const ordered = useMemo(() => [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [competitions.data])
  const position = useMemo(() => new Map(ordered.map((c, i) => [c.id, i])), [ordered])

  // The events of a class, per competition and then by number
  const eventsOf = (name: string) =>
    (events.data ?? [])
      .filter((e) => e.class === name && (competitionId === 'all' || e.competitionId === competitionId))
      .sort((a, b) => (position.get(a.competitionId) ?? 0) - (position.get(b.competitionId) ?? 0) || a.number - b.number)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = classes.filter((c) => !needle || c.name.toLowerCase().includes(needle))
  const competitionName = (id: string) => ordered.find((c) => c.id === id)?.name ?? ''

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search classes" value={query} onChange={setQuery} />
        <div className="w-full sm:w-72">
          <Select label="Competition" value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
            <option value="all">All competitions</option>
            {ordered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>New class</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<ClassDef>
        loading={isLoading}
        rows={rows}
        rowKey={(c) => c.name}
        minWidthClass="min-w-0"
        paginationLabel="Classes pagination"
        detailTitle={(c) => `Class ${c.name}`}
        detailExtra={(c) => {
          const list = eventsOf(c.name)
          if (list.length === 0) return null
          const groups = [...new Set(list.map((e) => e.competitionId))]
          return (
            <section aria-label="Events" className="flex flex-col gap-5 border-t border-neutral-200 pt-6">
              <h3 className="font-mono text-xs uppercase text-neutral-500">All events ({list.length})</h3>
              {groups.map((id) => (
                <div key={id} className="flex flex-col gap-1">
                  <h4 className="text-small font-semibold text-neutral-900">{competitionName(id) || 'Competition'}</h4>
                  <ul className="flex flex-col">
                    {list
                      .filter((e) => e.competitionId === id)
                      .map((e) => (
                        <li key={e.id} className="flex gap-3 border-b border-neutral-100 py-1.5 text-small last:border-b-0">
                          <span className="w-12 shrink-0 font-mono tabular-nums text-neutral-500">{eventCode(e)}</span>
                          <span className="flex-1 text-neutral-900">{eventDances(e)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          )
        }}
        empty={needle ? { title: 'No classes match', description: 'Try a different name.' } : { title: 'No classes yet', description: 'Add one so events can be created.' }}
        columns={[
          { key: 'name', header: 'Class', widthClass: 'w-32', cell: (c) => <span className="font-medium text-neutral-900">{c.name}</span> },
          { key: 'events', header: 'Events', cell: (c) => (events.data ? eventsOf(c.name).length : '–'), mono: true, muted: true, widthClass: 'w-24' },
          {
            key: 'list',
            header: 'Event list',
            detail: false,
            wrap: true,
            hideBelow: 'sm',
            cell: (c) => {
              const list = eventsOf(c.name)
              if (list.length === 0) return <span className="text-neutral-500">–</span>
              const shown = list.slice(0, SHOWN)
              return (
                <div className="flex flex-col gap-2 py-1">
                  {[...new Set(shown.map((e) => e.competitionId))].map((id) => (
                    <div key={id} className="flex flex-col gap-1">
                      <span className="text-small text-neutral-500">{competitionName(id) || 'Competition'}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {shown
                          .filter((e) => e.competitionId === id)
                          .map((e) => (
                            <span key={e.id} className="whitespace-nowrap rounded-md border border-neutral-200 px-2 py-0.5 text-small text-neutral-900">
                              <span className="font-mono text-neutral-500">{eventCode(e)}</span> {eventDances(e).replaceAll(', ', ' · ')}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                  {list.length > SHOWN && <span className="text-small text-neutral-500">+ {list.length - SHOWN} more …</span>}
                </div>
              )
            },
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Rename ${c.name}`} onClick={() => setEditing(c)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${c.name}`} onClick={() => setToDelete(c)} />
              </div>
            ),
          },
        ]}
      />

      <ClassDialog open={editing !== null} cls={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

      <DeleteDialog kind="class" target={toDelete ? { id: toDelete.name, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
