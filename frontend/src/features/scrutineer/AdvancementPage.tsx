import { DEFAULT_ADVANCEMENT, RoundType, checkAdvancementRules, type AdvancementRule } from '@bis/shared'
import { ArrowRight, Check, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, ErrorState, PageHeader, SkeletonList, toast } from '../../components/ui/index.ts'
import { useAdvancementRules, useSetAdvancementRules } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL } from '../../lib/format.ts'

const EARLY = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal]
const COLUMNS = [...EARLY, RoundType.Final]

const TEXT = 'font-mono text-body tabular-nums text-neutral-900'

const GRID = 'grid-cols-[repeat(6,minmax(0,1fr))_3.5rem]'

function Cell({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center border-l border-neutral-200 px-4 py-3 first:border-l-0">{children}</div>
}

// One fixed-size control per cell; a round that is off fades back
function Slot({ off, children }: { off?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex h-10 w-full max-w-28 items-center gap-3 rounded-md border px-3 transition-colors focus-within:border-gold-500',
        off ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-300 bg-white',
      )}
    >
      {children}
    </div>
  )
}

// The path an event takes for this row: each round and how many couples dance in it, as a line of text joined by arrows
function Path({ steps }: { steps: Array<{ type: RoundType; count: string }> }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-y-1 text-small">
      {steps.map((step, k) => {
        const final = step.type === RoundType.Final
        return (
          <li key={step.type} className="flex items-center">
            {k > 0 && <ArrowRight aria-hidden className="mx-3 size-3.5 shrink-0 text-neutral-300" strokeWidth={2} />}
            <span className="flex items-baseline gap-1.5">
              {final && <span aria-hidden className="size-1.5 self-center rounded-full bg-gold-400" />}
              <span className="font-medium text-neutral-900">{ROUND_TYPE_LABEL[step.type]}</span>
              <span className="font-mono text-xs tabular-nums text-neutral-500">{step.count}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const MARK = 'font-mono text-small font-medium tabular-nums text-neutral-900'

// What the symbols in the table mean
function Legend() {
  const items: Array<[ReactNode, string]> = [
    [
      <span key="on" aria-hidden className="grid size-4 place-items-center rounded-[4px] bg-neutral-900 text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>,
      'Round is danced',
    ],
    [<span key="off" aria-hidden className="size-4 rounded-[4px] border border-neutral-400 bg-neutral-50" />, 'Round is not danced'],
    [<span key="all" className={MARK}>All</span>, 'Every couple dances the first round'],
    [<span key="n" aria-hidden className="h-4 w-7 rounded-[4px] border border-neutral-400 bg-white" />, 'Type how many couples dance in that round'],
    [<span key="from" className="text-small font-semibold text-neutral-900">From entries</span>, 'The row applies from this many entries up to the next row'],
  ]
  return (
    <section aria-label="Legend" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <h2 className="shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Legend</h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map(([sample, text]) => (
          <li key={text} className="flex items-center gap-2 text-small text-neutral-600">
            {sample}
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}

function NumberBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 bg-transparent font-mono text-body tabular-nums text-neutral-900 outline-none"
    />
  )
}

// One row while typing: which rounds are danced, and how many couples dance in each (the first round is everyone)
interface Row {
  from: string
  on: Record<string, boolean>
  size: Record<string, string>
}

const toRows = (rules: AdvancementRule[]): Row[] =>
  rules.map((r) => {
    const on: Row['on'] = {}
    const size: Row['size'] = {}
    r.rounds.forEach((round, k) => {
      if (round.type !== RoundType.Final) on[round.type] = true
      // A round dances as many couples as the round before it recalled
      const before = r.rounds[k - 1]
      if (before?.recall != null) size[round.type] = String(before.recall)
    })
    return { from: String(r.from), on, size }
  })

const toRules = (rows: Row[]): AdvancementRule[] =>
  rows.map((r) => {
    const types = [...EARLY.filter((t) => r.on[t]), RoundType.Final]
    return {
      from: Number(r.from),
      rounds: types.map((type, k) => {
        const next = types[k + 1]
        const text = next ? (r.size[next] ?? '') : ''
        return { type, recall: next ? (text === '' ? Number.NaN : Number(text)) : null }
      }),
    }
  })

function Table({ competitionId, initial }: { competitionId: string; initial: AdvancementRule[] }) {
  const save = useSetAdvancementRules(competitionId)
  const [rows, setRows] = useState<Row[]>(() => toRows(initial))
  const [error, setError] = useState<string | null>(null)

  const patch = (i: number, fn: (r: Row) => Row) => setRows((all) => all.map((r, at) => (at === i ? fn(r) : r)))

  function submit() {
    const checked = checkAdvancementRules(toRules(rows))
    if ('error' in checked) return setError(checked.error)
    setError(null)
    save.mutate(checked.values, {
      onSuccess: () => toast.success('Advancement table saved'),
      onError: (e) => setError(e.message),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Legend />

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <div className={cn(GRID, 'hidden border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 lg:grid')}>
          {['From entries', ...COLUMNS.map((t) => ROUND_TYPE_LABEL[t])].map((label, k) => (
            <span key={label} className={cn('px-4 py-3', k > 0 && 'border-l border-neutral-200')}>
              {label}
            </span>
          ))}
          <span className="border-l border-neutral-200" />
        </div>
        <ul>
          {rows.map((row, i) => {
            const first = EARLY.find((t) => row.on[t])
            const isOn = (type: RoundType) => type === RoundType.Final || !!row.on[type]
            const isAll = (type: RoundType) => (type === RoundType.Final ? first === undefined : first === type)
            const tick = (type: RoundType) => (
              <input
                type="checkbox"
                aria-label={`${ROUND_TYPE_LABEL[type]} is danced`}
                checked={isOn(type)}
                onChange={(e) => patch(i, (r) => ({ ...r, on: { ...r.on, [type]: e.target.checked } }))}
                className="size-4 shrink-0 accent-neutral-900"
              />
            )
            const size = (type: RoundType) =>
              isAll(type) ? (
                <span className={TEXT}>All</span>
              ) : (
                <NumberBox
                  label={`Couples dancing in the ${ROUND_TYPE_LABEL[type]}`}
                  value={row.size[type] ?? ''}
                  onChange={(v) => patch(i, (r) => ({ ...r, size: { ...r.size, [type]: v } }))}
                />
              )
            const from =
              i === 0 ? <span className={TEXT}>{row.from}</span> : <NumberBox label="From entries" value={row.from} onChange={(v) => patch(i, (r) => ({ ...r, from: v }))} />
            const remove = (
              <button
                type="button"
                aria-label={`Remove the row from ${row.from} entries`}
                onClick={() => setRows((all) => all.filter((_, at) => at !== i))}
                className="grid size-9 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-gold-50 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <Trash2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
              </button>
            )
            const summary = <Path steps={COLUMNS.filter(isOn).map((t) => ({ type: t, count: isAll(t) ? 'all' : row.size[t] || '?' }))} />
            return (
              <li key={i} className="group relative border-b border-neutral-200 transition-colors duration-200 last:border-b-0 before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-0.5 before:bg-gold-400 before:opacity-0 before:transition-opacity hover:before:opacity-100 focus-within:before:opacity-100">
                {/* Phones and tablets: one list per row, a line for each round */}
                <div className="flex flex-col gap-4 px-4 pb-4 lg:hidden">
                  <div className="-mx-4 flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">When the event has</span>
                      <div className="flex items-center gap-3 text-body font-semibold text-neutral-900">
                        {i === 0 ? (
                          <span>1 entry or more</span>
                        ) : (
                          <>
                            <div className="w-20">
                              <Slot>{from}</Slot>
                            </div>
                            <span>entries or more</span>
                          </>
                        )}
                      </div>
                    </div>
                    {i > 0 && remove}
                  </div>
                  <div>
                    <div className="flex justify-between border-b border-neutral-200 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      <span>Rounds danced</span>
                      <span>Couples in round</span>
                    </div>
                    {COLUMNS.map((type) => {
                      const final = type === RoundType.Final
                      const on = isOn(type)
                      return (
                        <div key={type} className="flex h-12 items-center justify-between gap-3 border-b border-neutral-100 last:border-b-0">
                          <label className={cn('flex items-center gap-3 text-small', on ? 'font-medium text-neutral-900' : 'text-neutral-400')}>
                            {final ? <span aria-hidden className="size-4" /> : tick(type)}
                            {ROUND_TYPE_LABEL[type]}
                          </label>
                          {on ? (
                            <div className="w-20">
                              <Slot>{size(type)}</Slot>
                            </div>
                          ) : (
                            <span className="text-small text-neutral-400">Not danced</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="pt-1">{summary}</div>
                </div>

                {/* Laptop: a table row */}
                <div className={cn(GRID, 'hidden lg:grid')}>
                  <Cell>
                    <Slot>{from}</Slot>
                  </Cell>
                  {COLUMNS.map((type) => (
                    <Cell key={type}>
                      <Slot off={!isOn(type)}>
                        {type !== RoundType.Final && tick(type)}
                        {isOn(type) && size(type)}
                      </Slot>
                    </Cell>
                  ))}
                  <div className="flex items-center justify-center border-l border-neutral-200">{i > 0 && remove}</div>
                  <div className="col-span-full border-t border-neutral-200 bg-neutral-50 px-4 py-3">{summary}</div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setRows((all) => [...all, { from: String((Number(all.at(-1)?.from) || 0) + 1), on: {}, size: {} }])}>
            Add row
          </Button>
          <Button variant="secondary" onClick={() => setRows(toRows(DEFAULT_ADVANCEMENT))}>
            Use the standard table
          </Button>
        </div>
        <Button onClick={submit} disabled={save.isPending}>
          Save table
        </Button>
      </div>
    </div>
  )
}

// How many rounds an event runs, and how many couples dance in each, by the number of entries
export function AdvancementPage() {
  const { competitionId } = useCompetitionChoice(null)
  const rules = useAdvancementRules(competitionId ?? '')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Advancement" description="For each number of entries, choose the rounds an event dances and how many couples dance in each round." />
      {rules.isError ? (
        <ErrorState onRetry={() => void rules.refetch()} />
      ) : !rules.data ? (
        <SkeletonList rows={4} />
      ) : (
        <Table key={competitionId} competitionId={competitionId ?? ''} initial={rules.data} />
      )}
    </div>
  )
}
