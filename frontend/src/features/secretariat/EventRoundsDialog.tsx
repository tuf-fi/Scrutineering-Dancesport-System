import { RoundStatus, RoundType, checkRoundPlan, suggestRounds, type RoundPlanInput, type ScheduleItem } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSetEventRounds } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

const FORM_ID = 'event-rounds-form'
const TYPES = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal, RoundType.Final]
// A starting number when a round is switched on
const START: Record<string, string> = { round_1: '48', round_2: '24', quarter_final: '12', semi_final: '6' }

type Picked = Record<string, string | null>

// Which rounds are on, and how many each recalls (a text while typing)
const toPicked = (plan: RoundPlanInput[]): Picked => Object.fromEntries(plan.map((p) => [p.type, p.recall === null ? '' : String(p.recall)]))

function RoundsForm({ item, onDone }: { item: ScheduleItem; onDone: () => void }) {
  const save = useSetEventRounds()
  const suggestion = suggestRounds(item.entryCount)
  const [picked, setPicked] = useState<Picked>(() => toPicked(item.rounds.length > 0 ? item.rounds.map((r) => ({ type: r.type, recall: r.recall })) : suggestion))
  const [error, setError] = useState<string | null>(null)
  const started = item.rounds.some((r) => r.status !== RoundStatus.Pending)

  const plan = (): RoundPlanInput[] =>
    TYPES.filter((type) => picked[type] !== undefined).map((type) => ({ type, recall: type === RoundType.Final ? null : Number(picked[type]) }))

  function toggle(type: RoundType, on: boolean) {
    setPicked((p) => {
      const next = { ...p }
      if (on) next[type] = START[type] ?? ''
      else delete next[type]
      return next
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const checked = checkRoundPlan(plan())
    if ('error' in checked) return setError(checked.error)
    setError(null)
    save.mutate(
      { eventId: item.eventId, plan: checked.values },
      {
        onSuccess: () => {
          toast.success(`Rounds saved for ${eventCode({ number: item.eventNumber })}`)
          onDone()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <p className="text-small text-neutral-600">
          {item.entryCount} {item.entryCount === 1 ? 'couple is' : 'couples are'} entered. For that many the system suggests{' '}
          <span className="font-medium text-neutral-900">{suggestion.map((p) => ROUND_TYPE_LABEL[p.type]).join(' › ')}</span>.
        </p>
        <fieldset className="flex flex-col" disabled={started}>
          <legend className="mb-1 text-small font-medium text-neutral-600">Rounds</legend>
          <ul className="border-y border-neutral-200">
            {TYPES.map((type) => {
              const on = picked[type] !== undefined
              const final = type === RoundType.Final
              return (
                <li key={type} className="flex min-h-14 items-center justify-between gap-4 border-b border-neutral-100 py-2 last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
                    <input type="checkbox" checked={on} disabled={final || started} onChange={(e) => toggle(type, e.target.checked)} className="size-5 accent-neutral-900" />
                    {ROUND_TYPE_LABEL[type]}
                  </label>
                  {on && !final && (
                    <div className="w-40">
                      <Input
                        label="Couples recalled"
                        inputMode="numeric"
                        value={picked[type] ?? ''}
                        onChange={(e) => setPicked((p) => ({ ...p, [type]: e.target.value }))}
                        className="font-mono tabular-nums"
                      />
                    </div>
                  )}
                  {on && final && <span className="text-small text-neutral-500">The final is always danced</span>}
                </li>
              )
            })}
          </ul>
        </fieldset>
        {started ? (
          <p className="text-small text-neutral-600">This event has started, so its rounds can no longer change.</p>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setPicked(toPicked(suggestion))}>
            Use the suggestion
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </>
  )
}

// The rounds of one event: which are danced and how many couples each recalls
export function EventRoundsDialog({ item, onClose }: { item: ScheduleItem | null; onClose: () => void }) {
  const started = item?.rounds.some((r) => r.status !== RoundStatus.Pending) ?? false
  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      className="max-w-md"
      title={item ? `Rounds for ${eventCode({ number: item.eventNumber })} ${eventDances(item)}` : 'Rounds'}
      description="Choose the rounds this event runs. The program follows."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {started ? 'Close' : 'Cancel'}
          </Button>
          {!started && (
            <Button type="submit" form={FORM_ID}>
              Save rounds
            </Button>
          )}
        </>
      }
    >
      {item && <RoundsForm key={item.eventId} item={item} onDone={onClose} />}
    </Dialog>
  )
}
