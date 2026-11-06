import { syllabusFor, type AgeGroup, type Class, type Dance, type Discipline, type MarkingTask, type MarkSubmission, type RoundType } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog, DarkPanel, Tabs } from '../../components/ui/index.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances, ordinal } from '../../lib/format.ts'
import { PlacingBoard } from './PlacingBoard.tsx'
import { SignaturePad } from './SignaturePad.tsx'
import { NumberGrid } from './NumberGrid.tsx'
import { useCatalog } from '../../hooks/index.ts'

export type Answers = Partial<Record<Dance, string[]>>

// The event after this one, as the program has it
export interface NextEvent {
  eventNumber: number
  dances: Dance[]
  roundType: RoundType
  ageGroup: AgeGroup | null
  class: Class | null
  discipline: Discipline | null
}

// How many marks a dance needs: the recall number, or everyone in a final
const marksNeeded = (task: MarkingTask) => task.recallNumber ?? task.competitors.length

interface MarkSheetProps {
  task: MarkingTask
  // The event after this one; shown under the event
  next?: NextEvent | null
  // Answers already made, e.g. a draft kept on the phone
  initial?: Answers
  // Called after every change, so a draft can be kept
  onChange?: (answers: Answers) => void
  onSubmit: (submissions: MarkSubmission[], signature?: string) => void
  busy?: boolean
  // The adjudicator signs before the marks go: on their own phone, not for a paper sheet typed in by the scrutineer
  sign?: boolean
  // For the confirmation: the adjudicator's own marks, or ones typed in from a paper sheet
  confirm?: { title: string; description: string; action: string }
  // The scrutineer's laptop: ordinary button sizes and corners instead of the large touch targets of a phone
  compact?: boolean
}

const OWN_MARKS = {
  title: 'Submit your marks?',
  description: 'You cannot change them once they are sent.',
  action: 'Confirm',
}

// The marking screen: X marks for early rounds, placings for a final. Used on the adjudicator's phone and,
// for a paper sheet, on the scrutineer's laptop.
export function MarkSheet({ task, next, initial = {}, onChange, onSubmit, busy = false, sign = false, confirm = OWN_MARKS, compact = false }: MarkSheetProps) {
  const { eventGrade, catalog } = useCatalog()
  const [answers, setAnswers] = useState<Answers>(initial)
  const [dance, setDance] = useState<Dance>(task.dances[0])
  const [confirming, setConfirming] = useState(false)
  // With a signature there are two steps: look over the numbers, then sign to finalize
  const [step, setStep] = useState<'review' | 'sign'>('review')
  const [signature, setSignature] = useState<string | null>(null)

  const isFinal = task.recallNumber === null
  const group = catalog.ageGroups.find((g) => g.id === task.event.ageGroup)
  const syllabus = syllabusFor(task.event, group?.family ?? task.event.ageGroup)
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

  // A round with several dances has a tab for each: choose the numbers of one dance at a time
  const table = !isFinal
  const several = table && task.dances.length > 1
  const doneDances = task.dances.filter((d) => countOf(d) === total).length
  const over = several ? task.dances.some((d) => countOf(d) > total) : current.length > total

  const counter = isFinal
    ? `${current.length} of ${total} placed`
    : several
      ? over
        ? 'Too many X in a dance'
        : `${doneDances} of ${task.dances.length} dances done`
      : current.length > total
        ? `${current.length - total} too many`
        : `${current.length} of ${total} marked`

  const progress = several
    ? Math.round((task.dances.reduce((sum, d) => sum + Math.min(countOf(d), total), 0) / (total * task.dances.length)) * 100)
    : Math.min(100, Math.round((current.length / total) * 100))

  return (
    <div className="flex flex-1 flex-col gap-6">
      <DarkPanel as="header" className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-brown-100">Event</span>
          <h1 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">{eventDances(task.event)}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-small text-brown-100">
            <span className="font-mono tabular-nums text-gold-400">{eventCode(task.event)}</span>
            <span aria-hidden className="h-3 w-px bg-white/25" />
            {ROUND_TYPE_LABEL[task.round.type]} · {eventGrade(task.event)}
          </p>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-small">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-brown-100">Next event</span>
          {next ? (
            <span className="font-medium text-white/85">
              <span className="mr-2 font-mono tabular-nums text-gold-400">{eventCode({ number: next.eventNumber })}</span>
              {next.dances.map((d) => DANCE_LABEL[d]).join(', ')}
              <span className="ml-2 text-brown-100">
                {ROUND_TYPE_LABEL[next.roundType]}
                {next.ageGroup && next.class && next.discipline ? ` · ${eventGrade({ ageGroup: next.ageGroup, class: next.class, discipline: next.discipline })}` : ''}
              </span>
            </span>
          ) : (
            <span className="text-white/50">–</span>
          )}
        </p>
        <p className="flex items-baseline gap-3 border-t border-white/10 pt-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-brown-100">{isFinal ? 'Place' : 'Select'}</span>
          <span aria-hidden className="font-mono text-4xl font-semibold leading-none tabular-nums text-gold-400">{total}</span>
          <span className="text-small text-brown-100">
            {isFinal ? `Place all ${total} finalists, 1st to ${ordinal(total)}.` : `Mark an X for exactly ${total} in each dance.`}
          </span>
        </p>
      </DarkPanel>

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
          <NumberGrid
            competitors={task.competitors}
            selected={current}
            locked={current.length >= total}
            onToggle={(id) => set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])}
          />
        )}
      </section>

      {syllabus && (
        <section aria-label="Syllabus" className="mb-4 rounded-lg border border-neutral-200 p-4">
          <h3 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Syllabus</h3>
          <p className="mt-2 whitespace-pre-line text-small text-neutral-700">{syllabus}</p>
        </section>
      )}

      <div className={compact ? 'mt-auto border-t border-neutral-100 bg-white' : 'sticky bottom-0 mt-auto border-t border-neutral-100 bg-white'}>
        <div aria-hidden className="h-0.5 bg-neutral-100">
          <div
            className={`h-full transition-[width] duration-200 ${over ? 'bg-danger' : 'bg-gold-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p role="status" className={`whitespace-nowrap text-body font-medium tabular-nums ${over ? 'text-danger' : 'text-neutral-900'}`}>
            {counter}
          </p>
          <Button {...(compact ? {} : { size: 'lg' as const })} className={compact ? undefined : 'h-14 min-w-32'} disabled={!ready} onClick={() => setConfirming(true)}>
            Submit
          </Button>
        </div>
      </div>

      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false)
          setSignature(null)
          setStep('review')
        }}
        className={compact ? undefined : 'rounded-none'}
        title={sign ? (step === 'review' ? (isFinal ? 'Review your placings' : 'Review your selection') : 'Sign to finalize') : confirm.title}
        description={sign ? (step === 'review' ? 'Check the numbers. You cannot change them once they are sent.' : 'Your signature finalizes your marks for this round.') : confirm.description}
        actions={
          <>
            <Button
              variant="secondary"
              {...(compact ? {} : { size: 'lg' as const })}
              className={compact ? 'flex-1 whitespace-nowrap' : 'flex-1 whitespace-nowrap rounded-none'}
              onClick={() => {
                if (sign && step === 'sign') {
                  setStep('review')
                  setSignature(null)
                } else {
                  setConfirming(false)
                  setSignature(null)
                }
              }}
            >
              Back
            </Button>
            <Button
              {...(compact ? {} : { size: 'lg' as const })}
              className={compact ? 'flex-[2] whitespace-nowrap' : 'flex-[2] whitespace-nowrap rounded-none'}
              disabled={busy || (sign && step === 'sign' && !signature)}
              onClick={() => {
                if (sign && step === 'review') return setStep('sign')
                const marks = task.dances.map((d) => ({ dance: d, competitorIds: answers[d] ?? [] }))
                if (sign && signature) onSubmit(marks, signature)
                else onSubmit(marks)
                setConfirming(false)
                setStep('review')
              }}
            >
              {busy ? 'Sending…' : sign ? (step === 'review' ? 'Final and submit' : 'Finalize') : confirm.action}
            </Button>
          </>
        }
      >
        {(!sign || step === 'review') && (
          <div className="flex flex-col gap-5">
            {task.dances.map((d) => {
              const ids = answers[d] ?? []
              return (
                <section key={d} aria-label={task.dances.length > 1 ? DANCE_LABEL[d] : 'Your numbers'} className="flex flex-col gap-2">
                  {task.dances.length > 1 && <h3 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{DANCE_LABEL[d]}</h3>}
                  {isFinal ? (
                    <ol className="border-y border-neutral-200">
                      {ids.map((id, i) => (
                        <li key={id} className="grid grid-cols-[4rem_1fr] items-baseline border-t border-neutral-100 py-2 first:border-t-0">
                          <span className="font-mono text-small text-neutral-500">{ordinal(i + 1)}</span>
                          <span className="font-mono text-xl font-semibold tabular-nums text-neutral-900">{String(backNumber.get(id) ?? '').padStart(3, '0')}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="grid grid-cols-4 gap-2">
                      {[...ids]
                        .map((id) => backNumber.get(id) ?? 0)
                        .sort((x, y) => x - y)
                        .map((n) => (
                          <li key={n} className="border border-neutral-200 py-2.5 text-center font-mono text-lg font-semibold tabular-nums text-neutral-900">
                            {String(n).padStart(3, '0')}
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
        {sign && step === 'sign' && <SignaturePad key="signature" onChange={setSignature} />}
      </Dialog>
    </div>
  )
}
