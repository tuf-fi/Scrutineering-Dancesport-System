import type { Adjudicator } from '@bis/shared'
import { ClipboardCheck, KeyRound, LogOut, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatars } from '../../components/Avatars.tsx'
import {
  Button,
  ButtonLink,
  Dialog,
  ErrorState,
  IconButton,
  SearchField,
  Table,
  Toolbar,
  toast,
} from '../../components/ui/index.ts'
import {
  useAdjudicatorPins,
  useAdjudicators,
  useDeleteAdjudicator,
  useGeneratePins,
} from '../../hooks/index.ts'
import { AdjudicatorAssignments } from './AdjudicatorAssignments.tsx'
import { AdjudicatorDialog } from './AdjudicatorDialog.tsx'
import { SignOutDialog, type SignOutTarget } from './SignOutDialog.tsx'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
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
  const [signOut, setSignOut] = useState<SignOutTarget | null>(null)
  // The adjudicators whose PIN cards are to be printed; none chosen prints every card
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (adjudicators.isError || pins.isError) {
    return <ErrorState onRetry={() => void Promise.all([adjudicators.refetch(), pins.refetch()])} />
  }

  const all = adjudicators.data ?? []
  const pinOf = (id: string) => pins.data?.find((p) => p.adjudicatorId === id)?.pin
  const missing = all.filter((a) => !pinOf(a.id)).length
  const needle = query.trim().toLowerCase()
  const visible = all.filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.letter.toLowerCase() === needle)
  const withPin = visible.filter((a) => pinOf(a.id))
  const chosen = all.filter((a) => selected.has(a.id) && pinOf(a.id))
  const allChosen = withPin.length > 0 && withPin.every((a) => selected.has(a.id))
  const printPath = `/print/pin-cards/${competitionId}?ids=${chosen.map((a) => a.id).join(',')}`

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current)
      for (const a of withPin) allChosen ? next.delete(a.id) : next.add(a.id)
      return next
    })
  }

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
      <Toolbar className="justify-between gap-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <SearchField className="w-full sm:w-72" label="Search adjudicators" value={query} onChange={setQuery} />
          <CompetitionSelect list={competitions} value={competitionId} onChange={onCompetitionChange} />
        </div>
        {/* A plain row, not ToolbarActions: when it wraps under the filters it lines up with their left edge */}
        <div className="flex flex-wrap items-center gap-2">
          {competitionId && pins.data && pins.data.length > 0 && (
            chosen.length > 0 ? (
              <ButtonLink variant="secondary" to={printPath} target="_blank">
                Print {chosen.length} PIN {chosen.length === 1 ? 'card' : 'cards'}
              </ButtonLink>
            ) : (
              <Button variant="secondary" disabled title="Choose whose PIN card to print">
                Print PIN cards
              </Button>
            )
          )}
          {missing > 0 && (
            <Button variant="secondary" disabled={generate.isPending} onClick={() => run()}>
              Generate {missing} missing
            </Button>
          )}
          <Button
            disabled={!lettersFree}
            title={lettersFree ? undefined : 'All ten letters, A to J, are in use'}
            onClick={() => setEditing('new')}
          >
            Add adjudicator
          </Button>
        </div>
      </Toolbar>

      <Table<Adjudicator>
        loading={adjudicators.isLoading || pins.isLoading}
        rows={visible}
        rowKey={(a) => a.id}
        minWidthClass="min-w-0"
        paginationLabel="Adjudicators pagination"
        detailTitle={(a) => a.name}
        detailSections={(a) => [{ id: 'assignments', label: 'Assignments', icon: ClipboardCheck, content: <AdjudicatorAssignments adjudicatorId={a.id} /> }]}
        empty={
          needle
            ? { title: `No adjudicators match "${query.trim()}"`, description: 'Try a name or a letter.' }
            : { title: 'No adjudicators yet', description: 'Add the first adjudicator.' }
        }
        columns={[
          {
            key: 'select',
            header: '',
            detail: false,
            widthClass: 'w-12',
            headerCell: (
              <input
                type="checkbox"
                aria-label="Select every adjudicator with a PIN"
                checked={allChosen}
                disabled={withPin.length === 0}
                onChange={toggleAll}
                className="size-4 accent-gold-500"
              />
            ),
            cell: (a) => (
              <input
                type="checkbox"
                aria-label={`Select ${a.name} to print the PIN card`}
                checked={selected.has(a.id) && Boolean(pinOf(a.id))}
                disabled={!pinOf(a.id)}
                onChange={() => toggle(a.id)}
                onClick={(e) => e.stopPropagation()}
                className="size-4 accent-gold-500"
              />
            ),
          },
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
                <IconButton icon={LogOut} label={`Sign ${a.name} out everywhere`} onClick={() => setSignOut({ kind: 'adjudicator', id: a.id, name: a.name })} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setToDelete(a)} />
              </div>
            ),
          },
        ]}
      />

      <SignOutDialog target={signOut} onClose={() => setSignOut(null)} />

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
