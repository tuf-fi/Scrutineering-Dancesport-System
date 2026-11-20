import type { ProgramRow } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog, Skeleton, toast } from '../../components/ui/index.ts'
import { useAdjudicators, usePanel, useRoundSets, useSetRoundSet } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, programLineName } from '../../lib/format.ts'

function SetForm({ row, competitionId, onClose }: { row: ProgramRow; competitionId: string; onClose: () => void }) {
  const panel = usePanel(row.eventId ?? '')
  const adjudicators = useAdjudicators()
  const sets = useRoundSets(competitionId)
  const save = useSetRoundSet(competitionId)
  const pool = (panel.data?.adjudicatorIds ?? []).flatMap((id) => adjudicators.data?.find((a) => a.id === id) ?? [])
  const current = sets.data?.find((s) => s.eventId === row.eventId && s.roundType === row.roundType)?.adjudicatorIds
  const [picked, setPicked] = useState<string[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  if (!panel.data || !adjudicators.data || !sets.data) return <Skeleton className="h-40 w-full" />
  const chosen = picked ?? current ?? pool.map((a) => a.id)
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  function submit() {
    if (chosen.length === 0) return setFailure('Choose at least one adjudicator.')
    setFailure(null)
    save.mutate(
      { eventId: row.eventId!, roundType: row.roundType!, adjudicatorIds: chosen.length === pool.length ? null : chosen },
      {
        onSuccess: () => {
          toast.success(`Adjudicators set for ${programLineName(row)}`)
          onClose()
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 flex w-full items-center justify-between text-small font-medium text-neutral-600">
          On the panel of {eventCode({ number: row.eventNumber! })}
          <button type="button" onClick={() => setPicked(pool.map((a) => a.id))} className="font-semibold text-neutral-900 underline underline-offset-4">
            Use the whole panel
          </button>
        </legend>
        {pool.map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
            <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => toggle(a.id)} className="size-5 accent-neutral-900" />
            <span className="font-mono font-semibold text-gold-700">{a.letter}</span>
            {a.name}
          </label>
        ))}
      </fieldset>
      <p className="text-small text-neutral-600">
        <span className="font-mono tabular-nums text-neutral-900">{chosen.length}</span> of {pool.length} mark this round. The others sit it out.
      </p>
      {failure && (
        <p role="alert" className="text-small text-danger">
          {failure}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// Chooses who marks one round from the event's panel, when not everyone does
export function RoundSetDialog({ row, competitionId, onClose }: { row: ProgramRow | null; competitionId: string; onClose: () => void }) {
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      className="max-w-md"
      title="Adjudicators of this round"
      description={row?.roundType && row.eventNumber !== null ? `${eventCode({ number: row.eventNumber })} ${ROUND_TYPE_LABEL[row.roundType]}. Only these adjudicators mark it.` : undefined}
    >
      {row && <SetForm key={row.slotId} row={row} competitionId={competitionId} onClose={onClose} />}
    </Dialog>
  )
}
