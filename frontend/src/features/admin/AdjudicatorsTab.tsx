import type { Adjudicator } from '@bis/shared'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatars } from '../../components/Avatars.tsx'
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  SearchField,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import {
  useAdjudicatorPins,
  useAdjudicators,
  useDeleteAdjudicator,
  useGeneratePins,
} from '../../hooks/index.ts'
import { AdjudicatorDialog } from './AdjudicatorDialog.tsx'
import { CompetitionSelect } from './CompetitionSelect.tsx'
import { LETTERS } from './constants.ts'

interface TabProps {
  competitionId: string
  competitions: Array<{ id: string; name: string }>
  onCompetitionChange: (id: string) => void
}

export function AdjudicatorsTab({ competitionId, competitions, onCompetitionChange }: TabProps) {
  const adjudicators = useAdjudicators()
  const pins = useAdjudicatorPins(competitionId)
  const generate = useGeneratePins()
  const remove = useDeleteAdjudicator()
  const [query, setQuery] = useState('')
  // The adjudicator being edited, or 'new' while adding one
  const [editing, setEditing] = useState<Adjudicator | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Adjudicator | null>(null)

  if (adjudicators.isError || pins.isError) {
    return <ErrorState onRetry={() => void Promise.all([adjudicators.refetch(), pins.refetch()])} />
  }

  const all = adjudicators.data ?? []
  const pinOf = (id: string) => pins.data?.find((p) => p.adjudicatorId === id)?.pin
  const missing = all.filter((a) => !pinOf(a.id)).length
  const needle = query.trim().toLowerCase()
  const visible = all.filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.letter.toLowerCase() === needle)
  const lettersFree = LETTERS.some((l) => !all.some((a) => a.letter === l))

  function run(adjudicatorId?: string) {
    generate.mutate(
      { competitionId, adjudicatorId },
      {
        onSuccess: () => toast.success(adjudicatorId ? 'New PIN set' : 'PINs generated'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  function doDelete(adjudicator: Adjudicator) {
    remove.mutate(adjudicator.id, {
      onSuccess: () => {
        setToDelete(null)
        toast.success(`Deleted ${adjudicator.name}`)
      },
      onError: (e) => {
        setToDelete(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search adjudicators" value={query} onChange={setQuery} />
        <CompetitionSelect list={competitions} value={competitionId} onChange={onCompetitionChange} />
        <ToolbarActions>
          <Button variant="secondary" disabled={missing === 0 || generate.isPending} onClick={() => run()}>
            {missing === 0 ? 'Everyone has a PIN' : `Generate ${missing} missing`}
          </Button>
          <Button
            disabled={!lettersFree}
            title={lettersFree ? undefined : 'All ten letters, A to J, are in use'}
            onClick={() => setEditing('new')}
          >
            Add adjudicator
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Adjudicator>
        loading={adjudicators.isLoading || pins.isLoading}
        rows={visible}
        rowKey={(a) => a.id}
        minWidthClass="min-w-0"
        paginationLabel="Adjudicators pagination"
        empty={
          needle
            ? { title: `No adjudicators match "${query.trim()}"`, description: 'Try a name or a letter.' }
            : { title: 'No adjudicators yet', description: 'Add the first adjudicator.' }
        }
        columns={[
          {
            key: 'name',
            header: 'Adjudicator',
            cell: (a) => (
              <div className="flex items-center gap-3">
                <Avatars names={[a.name]} />
                <span className="font-medium text-neutral-900">{a.name}</span>
              </div>
            ),
          },
          {
            key: 'letter',
            header: 'Letter',
            mono: true,
            cell: (a) => <span className="text-body font-semibold">{a.letter}</span>,
          },
          {
            key: 'pin',
            header: 'PIN',
            mono: true,
            cell: (a) => pinOf(a.id) ?? <span className="font-sans text-neutral-500">Not set</span>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-32',
            cell: (a) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Edit ${a.name}`} onClick={() => setEditing(a)} />
                <IconButton
                  icon={KeyRound}
                  label={`${pinOf(a.id) ? 'New PIN' : 'Set PIN'} for ${a.name}`}
                  disabled={generate.isPending}
                  onClick={() => run(a.id)}
                />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setToDelete(a)} />
              </div>
            ),
          },
        ]}
      />

      <AdjudicatorDialog
        open={editing !== null}
        adjudicator={editing === 'new' ? null : editing}
        takenLetters={all.map((a) => a.letter)}
        onClose={() => setEditing(null)}
      />

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="Their PINs are removed too. An adjudicator who is on a panel can't be deleted."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => toDelete && doDelete(toDelete)}>
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />
    </div>
  )
}
