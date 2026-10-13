import type { Announcement } from '@bis/shared'
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import logo from '../../assets/logo.png'
import { useAnnouncements, useCompetitions } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances, eventGrade, ordinal } from '../../lib/format.ts'

// Built for an LED wall: every size is in vmin so it holds on 16:9 and ultra-wide, pure black ground,
// no grey below neutral-300, and nothing thinner than a medium weight.

const MODES: Array<{ kind: Announcement['kind']; label: string; key: string }> = [
  { kind: 'call', label: 'Next event', key: '1' },
  { kind: 'recall', label: 'Recalled', key: '2' },
  { kind: 'finalists', label: 'Finalists', key: '3' },
  { kind: 'result', label: 'Results', key: '4' },
]

const EYEBROW: Record<Announcement['kind'], string> = {
  call: 'Next to the floor',
  recall: 'Recalled to the next round',
  finalists: 'Finalists',
  result: 'Results',
}

// Fewer numbers get bigger type; a long list steps down so it still fits the wall
function numberSize(count: number) {
  if (count <= 12) return { text: 'text-[9vmin]', cell: '19vmin' }
  if (count <= 24) return { text: 'text-[6.5vmin]', cell: '14vmin' }
  return { text: 'text-[5vmin]', cell: '11vmin' }
}

function Numbers({ numbers }: { numbers: number[] }) {
  const size = numberSize(numbers.length)
  return (
    <ul
      aria-label="Back numbers"
      className={cn('flex flex-wrap gap-y-[3vmin] font-mono font-semibold leading-none tabular-nums text-white', size.text)}
    >
      {numbers.map((n) => (
        <li key={n} style={{ width: size.cell }}>
          {n}
        </li>
      ))}
    </ul>
  )
}

function Heading({ item }: { item: Announcement }) {
  return (
    <header className="flex flex-col gap-[1.2vmin]">
      <p className="text-[1.8vmin] font-semibold uppercase tracking-[0.24em] text-gold-400">{EYEBROW[item.kind]}</p>
      <h1 className="flex items-baseline gap-[1.6vmin] text-[6.5vmin] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
        <span className="font-mono text-[4vmin] font-medium tracking-normal text-neutral-300">E{item.eventNumber}</span>
        {eventDances(item)}
      </h1>
      <p className="text-[2.3vmin] font-medium text-neutral-300">
        {ROUND_TYPE_LABEL[item.roundType]} · {eventGrade(item)}
      </p>
    </header>
  )
}

function View({ item, results, shown }: { item: Announcement; results: Announcement[]; shown: Set<string> }) {
  if (item.kind === 'result') {
    const r = item.result!
    const board = [...results].sort((a, b) => a.result!.place - b.result!.place)
    return (
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,38vmin)] items-start gap-x-[7vmin]">
        <div className="flex flex-col gap-[0.8vmin]">
          <p className="mb-[1.4vmin] text-[1.9vmin] font-semibold uppercase tracking-[0.2em] text-gold-400">{ordinal(r.place)} place</p>
          <p className="font-mono text-[19vmin] font-semibold leading-[0.95] tabular-nums text-white">{r.backNumber}</p>
          <p className="text-[4.4vmin] font-semibold leading-tight text-white">{r.names.join(' & ')}</p>
          <p className="text-[2.4vmin] font-medium text-neutral-300">{r.clubName}</p>
        </div>
        <ol aria-label="Results so far" className="flex flex-col border-t border-white/15">
          {board.map((a) => {
            const out = shown.has(a.id)
            const now = a.id === item.id
            return (
              <li
                key={a.id}
                className={cn(
                  'flex items-baseline gap-[2vmin] border-b border-white/15 px-[1.4vmin] py-[1.5vmin] text-[2.6vmin]',
                  now ? 'bg-white/10 text-white' : out ? 'text-neutral-200' : 'text-neutral-500',
                )}
              >
                <span className={cn('w-[8vmin] shrink-0', now && 'font-semibold text-gold-400')}>{ordinal(a.result!.place)}</span>
                <span className="w-[8vmin] shrink-0 font-mono font-semibold tabular-nums">{out ? a.result!.backNumber : '—'}</span>
                <span className="truncate text-[2.1vmin]">{out ? a.result!.names.join(' & ') : ''}</span>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-[3vmin]">
      <p className="text-[1.9vmin] font-semibold uppercase tracking-[0.2em] text-neutral-300">
        {item.kind === 'call' ? `Heat ${item.heat}` : `${item.numbers.length} competitors`}
      </p>
      <Numbers numbers={item.numbers} />
    </div>
  )
}

export function McHome() {
  const { data } = useAnnouncements()
  const competitions = useCompetitions()
  const [asked, setAsked] = useState(0)
  const [awake, setAwake] = useState(true)
  const items = useMemo(() => data ?? [], [data])
  const index = Math.min(asked, Math.max(0, items.length - 1))
  const current = items[index]
  const competitionName = [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.name

  const go = useCallback((to: number) => setAsked(Math.max(0, Math.min(items.length - 1, to))), [items.length])
  const jump = useCallback(
    (kind: Announcement['kind']) => {
      const first = items.findIndex((a) => a.kind === kind)
      if (first >= 0) setAsked(first)
    },
    [items],
  )
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }, [])

  // The controls fade out after a few idle seconds so the wall shows only the announcement
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const wake = () => {
      setAwake(true)
      clearTimeout(timer)
      timer = setTimeout(() => setAwake(false), 3000)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input,select,textarea')) return
      const mode = MODES.find((m) => m.key === e.key)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        // A focused button handles its own Enter and Space
        if (target?.closest('button') && (e.key === ' ' || e.key === 'Enter')) return
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        go(index - 1)
      } else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(items.length - 1)
      else if (mode) jump(mode.kind)
      else if (e.key.toLowerCase() === 'f') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jump, fullscreen, index, items.length])

  if (!current) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[11vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
          {data ? 'Waiting for the next announcement' : ''}
        </h1>
      </div>
    )
  }

  const results = items.filter((a) => a.kind === 'result')
  const shown = new Set(items.slice(0, index + 1).filter((a) => a.kind === 'result').map((a) => a.id))

  return (
    <div className={cn('flex flex-1 flex-col gap-[3.5vmin]', !awake && 'cursor-none')}>
      <div className="flex items-center justify-between gap-6">
        <img src={logo} alt="BIS" className="h-[8.5vmin] w-auto select-none rounded-[1.2vmin] bg-white px-[1.4vmin] py-[0.8vmin]" />
        <div className="flex flex-col items-end gap-[0.4vmin] text-[1.9vmin] font-medium text-neutral-300">
          <span>{competitionName}</span>
          <span className="font-mono tabular-nums" role="status">
            {index + 1} / {items.length}
          </span>
        </div>
      </div>

      <div key={current.id} className="flex flex-1 animate-fade-in flex-col gap-[3.5vmin]">
        <Heading item={current} />
        <div className="h-px bg-white/20" />
        <View item={current} results={results} shown={shown} />
      </div>

      <nav
        aria-label="Announcer controls"
        className={cn(
          'fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-black px-[5vmin] py-3 text-small text-neutral-200 transition-opacity duration-300',
          awake ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="flex items-center gap-1">
          {MODES.map((m) => (
            <button
              key={m.kind}
              type="button"
              onClick={() => jump(m.kind)}
              disabled={!items.some((a) => a.kind === m.kind)}
              className={cn(
                'rounded-md px-3 py-2 transition-colors hover:text-white disabled:opacity-30',
                current.kind === m.kind ? 'font-semibold text-gold-400' : 'text-neutral-200',
              )}
            >
              <span className="mr-2 font-mono text-xs text-neutral-300">{m.key}</span>
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous announcement" disabled={index === 0} onClick={() => go(index - 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label="Next announcement" disabled={index === items.length - 1} onClick={() => go(index + 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label="Full screen" onClick={fullscreen} className="grid size-10 place-items-center rounded-md hover:text-white">
            <Maximize aria-hidden className="size-4" />
          </button>
        </div>
      </nav>
    </div>
  )
}
