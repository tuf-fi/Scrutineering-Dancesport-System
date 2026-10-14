import type { Dance, MarkingTask, MarkSubmission } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog, Tabs } from '../../components/ui/index.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances, eventGrade, ordinal } from '../../lib/format.ts'
import { PlacingBoard } from './PlacingBoard.tsx'
import { XBoard } from './XBoard.tsx'

export type Answers = Partial<Record<Dance, string[]>>

// How many marks a dance needs: the recall number, or everyone in a final
const marksNeeded = (task: MarkingTask) => task.recallNumber ?? task.competitors.length

interface MarkSheetProps {
  task: MarkingTask
  // Answers already made, e.g. a draft kept on the phone
  initial?: Answers
  // Called after every change, so a draft can be kept
  onChange?: (answers: Answers) => void
  onSubmit: (submissions: MarkSubmission[]) => void
  busy?: boolean
  // For the confirmation: the adjudicator's own marks, or ones typed in from a paper sheet
  confirm?: { title: string; description: string; action: string }
}

const OWN_MARKS = {
  title: 'Submit your marks?',
  description: 'You cannot change them once they are sent.',
  action: 'Confirm',
}

// The marking screen: X marks for early rounds, placings for a final. Used on the adjudicator's phone and,
// for a paper sheet, on the scrutineer's laptop.
export function MarkSheet({ task, initial = {}, onChange, onSubmit, busy = false, confirm = OWN_MARKS }: MarkSheetProps) {
  const [answers, setAnswers] = useState<Answers>(initial)
  const [dance, setDance] = useState<Dance>(task.dances[0])
  const [confirming, setConfirming] = useState(false)

  const isFinal = task.recallNumber === null
  const total = marksNeeded(task)
  const countOf = (d: Dance) => answers[d]?.length ?? 0
  const ready = task.dances.every((d) => countOf(d) === total)
  const backNumber = new Map(task.competitors.map((c) => [c.id, c.backNumber]))
  const current = answers[dance] ?? []
  const set = (next: string[]) =>
    setAnswers((a) => {
      const updated = { ...a, [dance]: next }
      onChange?.(updated)
      return updated
    })

  const counter = isFinal
    ? `${current.length} of ${total} placed`
    : current.length > total
      ? `${current.length - total} too many`
      : `${current.length} of ${total} marked`

  const progress = Math.min(100, Math.round((current.length / total) * 100))

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {ROUND_TYPE_LABEL[task.round.type]} · {eventGrade(task.event)}
        </p>
        <h1 className="flex flex-col gap-1 text-display font-semibold leading-tight text-neutral-900">
          <span className="font-mono text-small font-medium text-neutral-500">{eventCode(task.event)}</span>
          {eventDances(task.event)}
        </h1>
        <p className="text-small text-neutral-600">
          {isFinal ? `Place all ${total} finalists, 1st to ${ordinal(total)}.` : `Mark an X for exactly ${total} in each dance.`}
        </p>
      </header>

      {task.dances.length > 1 && (
        <Tabs
          large
          label="Dance"
          value={dance}
          onChange={(id) => setDance(id as Dance)}
          items={task.dances.map((d) => ({ id: d, label: DANCE_LABEL[d], count: countOf(d) }))}
        />
      )}

      <section aria-label={DANCE_LABEL[dance]} className="flex-1 pb-4">
        {isFinal ? (
          <PlacingBoard key={dance} competitors={task.competitors} ranking={current} onChange={set} />
        ) : (
          <XBoard
            competitors={task.competitors}
            selected={current}
            onToggle={(id) => set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])}
          />
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white sm:-mx-8">
        <div aria-hidden className="h-0.5 bg-neutral-100">
          <div
            className={`h-full transition-[width] duration-200 ${current.length > total ? 'bg-danger' : 'bg-gold-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <p role="status" className={`whitespace-nowrap text-small ${current.length > total ? 'text-danger' : 'text-neutral-600'}`}>
            {counter}
          </p>
          <Button size="xl" className="min-w-40 rounded-xl text-xl" disabled={!ready} onClick={() => setConfirming(true)}>
            Submit
          </Button>
        </div>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={confirm.title}
        description={confirm.description}
        actions={
          <>
            <Button variant="ghost" size="xl" className="text-xl" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button
              size="xl"
              className="text-xl"
              disabled={busy}
              onClick={() => {
                onSubmit(task.dances.map((d) => ({ dance: d, competitorIds: answers[d] ?? [] })))
                setConfirming(false)
              }}
            >
              {busy ? 'Sending…' : confirm.action}
            </Button>
          </>
        }
      >
        <dl className="flex flex-col gap-3">
          {task.dances.map((d) => (
            <div key={d} className="flex flex-col gap-1">
              {task.dances.length > 1 && <dt className="text-small text-neutral-600">{DANCE_LABEL[d]}</dt>}
              <dd className="font-mono text-body tabular-nums text-neutral-900">
                {isFinal
                  ? (answers[d] ?? []).map((id, i) => `${ordinal(i + 1)} ${backNumber.get(id)}`).join(' · ')
                  : [...(answers[d] ?? [])]
                      .map((id) => backNumber.get(id) ?? 0)
                      .sort((a, b) => a - b)
                      .join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  )
}
