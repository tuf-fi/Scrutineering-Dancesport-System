import type { Announcement } from '@bis/shared'
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, usePlotArea } from 'recharts'
import logo from '../../assets/logo.png'
import { ErrorState } from '../../components/ui/index.ts'
import { useAnnouncements, useCompetitions } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances, eventGrade, ordinal } from '../../lib/format.ts'

// Built for an LED wall: every size is in vmin so it holds on 16:9 and ultra-wide, a deep brown ground with
// white type, no grey below brown-100 at half strength, and nothing thinner than a medium weight.

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

// 3rd to 1st place: the podium slides
const isPodium = (item: Announcement) => item.kind === 'result' && item.result!.place <= 3

// Says what the back numbers on a slide are for
const NUMBERS_FOR: Record<Announcement['kind'], string> = {
  call: 'Back numbers to the floor',
  recall: 'Back numbers recalled',
  finalists: 'Back numbers in the final',
  result: '',
}

// Fewer numbers get bigger type; a long list steps down so it still fits the wall
function numberSize(count: number) {
  if (count <= 12) return { text: 'text-[9vmin]', cell: '24vmin', gap: '2vmin', pad: 'py-[3.2vmin]' }
  if (count <= 24) return { text: 'text-[6.5vmin]', cell: '17vmin', gap: '1.6vmin', pad: 'py-[2.2vmin]' }
  return { text: 'text-[5vmin]', cell: '13vmin', gap: '1.2vmin', pad: 'py-[1.6vmin]' }
}

// Each number sits centred on a flat tile in an even grid, so three-digit numbers never run into their neighbours
function Numbers({ numbers }: { numbers: number[] }) {
  const size = numberSize(numbers.length)
  return (
    <ul
      aria-label="Back numbers"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size.cell}, 1fr))`, gap: size.gap }}
      className={cn('grid font-mono font-medium leading-none tabular-nums text-white', size.text)}
    >
      {numbers.map((n) => (
        <li key={n} className={cn('rounded-[1.6vmin] bg-white/[0.06] text-center', size.pad)}>
          {n}
        </li>
      ))}
    </ul>
  )
}

// The slide says what is happening first, then which event it is about
function Heading({ item }: { item: Announcement }) {
  const centred = item.kind === 'result'
  const compact = isPodium(item)
  const message = item.kind === 'result' ? `${ordinal(item.result!.place)} place` : EYEBROW[item.kind]
  return (
    <header className={cn('flex flex-col gap-[2vmin]', centred && 'items-center text-center')}>
      <h1 className={cn('font-semibold leading-none tracking-[-0.035em] text-white transition-[font-size] duration-700 ease-in-out motion-reduce:transition-none', centred ? (compact ? 'text-[5.5vmin]' : 'text-[8vmin]') : 'text-[11vmin]')}>{message}</h1>
      <div className={cn('flex gap-x-[2.4vmin]', compact ? 'flex-row flex-wrap items-baseline justify-center' : 'flex-col gap-y-[0.8vmin]', centred && !compact && 'items-center')}>
        <p className={cn('flex items-baseline gap-[1.6vmin] font-semibold text-white', centred ? 'text-[3vmin]' : 'text-[4vmin]')}>
          <span className="font-mono font-medium tabular-nums text-gold-400">E{item.eventNumber}</span>
          {eventDances(item)}
        </p>
        <p className={cn('font-medium text-brown-100', centred ? 'text-[2vmin]' : 'text-[2.6vmin]')}>
          {ROUND_TYPE_LABEL[item.roundType]} · {eventGrade(item)}
        </p>
      </div>
    </header>
  )
}

function View({ item }: { item: Announcement }) {
  // The winner block is drawn by the board, which moves it from here onto the podium
  if (item.kind === 'result') return <div data-hero-zone className="flex-1" />

  return (
    <div className="flex flex-1 flex-col gap-[3.5vmin]">
      <p className="flex flex-wrap items-baseline gap-x-[2vmin] gap-y-[0.6vmin]">
        <span className="text-[4.4vmin] font-semibold text-white">
          {item.kind === 'call' ? `Heat ${item.heat}` : `${item.numbers.length} competitors`}
        </span>
        <span className="text-[2.8vmin] font-medium text-brown-100">{NUMBERS_FOR[item.kind]}</span>
      </p>
      <Numbers numbers={item.numbers} />
    </div>
  )
}

// The winner block. Its type shrinks with the phase: big in the middle of the slide, small above the podium,
// smaller still on top of its bar. Position, scale and type size all ease between the phases.
const BLOCK = {
  big: { box: 'translate(-50%, -50%) scale(1)', number: 'text-[26vmin]', name: 'text-[5vmin]', club: 'text-[2.6vmin]' },
  above: { box: 'translate(-50%, -100%) scale(1)', number: 'text-[7.5vmin]', name: 'text-[3.2vmin]', club: 'text-[2vmin]' },
  bar: { box: 'translate(-50%, -100%) scale(0.92)', number: 'text-[7.5vmin]', name: 'text-[3.2vmin]', club: 'text-[2vmin]' },
} as const

function WinnerBlock({ result, phase, style, still = false }: { result: NonNullable<Announcement['result']>; phase: keyof typeof BLOCK; style: { left: number | string; top: number | string }; still?: boolean }) {
  const look = BLOCK[phase]
  const ease = still ? '' : 'transition-[font-size] duration-[900ms] ease-in-out motion-reduce:transition-none'
  return (
    <div
      className={cn(
        'pointer-events-none absolute flex origin-bottom flex-col items-center whitespace-nowrap text-center motion-reduce:transition-none',
        !still && 'transition-[left,top,transform] duration-[900ms] ease-in-out',
      )}
      style={{ ...style, transform: look.box }}
    >
      <div key={result.backNumber} className="flex animate-fade-in flex-col items-center">
        <p className={cn('font-mono font-semibold leading-none tabular-nums text-white', look.number, ease)}>{result.backNumber}</p>
        <p className={cn('mt-[0.6vmin] font-semibold leading-tight tracking-[-0.02em] text-white', look.name, ease)}>{result.names.join(' & ')}</p>
        <p className={cn('font-medium text-brown-100', look.club, ease)}>{result.clubName}</p>
      </div>
    </div>
  )
}

// Reports where the bars are drawn, so the winner block can land on top of its bar
function PlotProbe({ onPlot }: { onPlot: (area: { x: number; y: number; width: number; height: number }) => void }) {
  const area = usePlotArea()
  useEffect(() => {
    if (area) onPlot({ x: area.x, y: area.y, width: area.width, height: area.height })
  }, [area, onPlot])
  return null
}

// Results so far. It sits at the bottom right while the lower places are read, then slides to the bottom centre for
// 3rd to 1st, where the top three stand as bars above the list of the remaining places.
function Board({ item, results, shown, host }: { item: Announcement; results: Announcement[]; shown: Set<string>; host: HTMLElement | null }) {
  const board = [...results].sort((a, b) => a.result!.place - b.result!.place)
  const podium = isPodium(item)
  const bars = [2, 1, 3]
    .map((place) => board.find((a) => a.result!.place === place))
    .filter((a): a is Announcement => Boolean(a))
    .map((a) => ({
      id: a.id,
      place: ordinal(a.result!.place),
      height: 4 - a.result!.place,
      out: shown.has(a.id),
      now: a.id === item.id,
    }))
  const rows = board.filter((a) => !(podium && a.result!.place <= 3))

  // The new block is announced big first, then flies to its bar
  const [plot, setPlot] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const place = item.result!.place
  const [placedFor, setPlacedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!podium) return
    // 3rd place first has to finish shrinking from the big block of the place before it
    const timer = setTimeout(() => setPlacedFor(item.id), place === 3 ? 1500 : 450)
    return () => clearTimeout(timer)
  }, [podium, item.id, place])
  const chartRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<{ top: number; left: number; width: number; vmin: number } | null>(null)
  useLayoutEffect(() => {
    if (!podium || !host || !chartRef.current) return
    const vmin = Math.min(window.innerWidth, window.innerHeight) / 100
    const width = 78 * vmin
    const top = chartRef.current.getBoundingClientRect().top - host.getBoundingClientRect().top
    setGeo({ top, left: host.clientWidth / 2 - width / 2, width, vmin })
  }, [podium, host, plot])
  const barIndex = Math.max(0, [2, 1, 3].indexOf(item.result!.place))
  // Where the room for the winner block is, in the slide's own coordinates
  const [zone, setZone] = useState<{ x: number; y: number; top: number } | null>(null)
  useEffect(() => {
    const room = host?.querySelector('[data-hero-zone]')
    if (!host || !room) return
    const measure = () => {
      const box = room.getBoundingClientRect()
      const hostBox = host.getBoundingClientRect()
      setZone({ x: box.left - hostBox.left + box.width / 2, y: box.top - hostBox.top + box.height / 2, top: box.top - hostBox.top })
    }
    const frame = requestAnimationFrame(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(room)
    observer?.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [host, item.id, podium])
  const podiumItems = [2, 1, 3].map((place) => board.find((a) => a.result!.place === place)).filter((a): a is Announcement => Boolean(a))

  return (
    <div
      className="absolute bottom-0 flex flex-col gap-[1vmin] transition-[left,transform,width] duration-700 ease-in-out motion-reduce:transition-none"
      style={{ left: podium ? '50%' : '100%', transform: `translateX(${podium ? '-50%' : '-100%'})`, width: podium ? '78vmin' : '36vmin' }}
    >
      {podium && (
        <div ref={chartRef} aria-hidden className="relative animate-fade-in" style={{ height: '27vmin' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="6%">
              <PlotProbe onPlot={setPlot} />
              <YAxis hide domain={[0, 3]} />
              <XAxis dataKey="place" axisLine={false} tickLine={false} interval={0} tick={{ fill: 'currentColor', fontSize: '1.8vmin' }} className="text-brown-100" />
              <Bar dataKey="height" radius={[4, 4, 0, 0]}>
                {bars.map((d) => (
                  <Cell key={d.id} style={{ fill: d.now ? 'var(--color-gold-400)' : d.out ? 'rgb(255 255 255 / 0.28)' : 'rgb(255 255 255 / 0.08)' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

        </div>
      )}

      {host &&
        createPortal(
          <>
            {/* Places already announced keep a small block on their bar */}
            {podium &&
              geo &&
              plot &&
              podiumItems
                .filter((a) => shown.has(a.id) && a.id !== item.id)
                .map((a) => (
                  <WinnerBlock
                    key={a.id}
                    result={a.result!}
                    phase="bar"
                    style={{
                      left: geo.left + (geo.width * ([2, 1, 3].indexOf(a.result!.place) + 0.5)) / 3,
                      top: geo.top + plot.y + plot.height * (1 - (4 - a.result!.place) / 3) - 4,
                    }}
                    still
                  />
                ))}
            {/* The block being announced: big in the middle, then it shrinks onto the podium */}
            {(podium ? geo : zone) && (
              <WinnerBlock
                key={item.result!.place < 3 ? item.id : 'hero'}
                result={item.result!}
                phase={!podium ? 'big' : placedFor === item.id && plot ? 'bar' : 'above'}
                style={
                  !podium
                    ? { left: zone!.x, top: zone!.y }
                    : placedFor === item.id && plot && geo
                      ? { left: geo.left + (geo.width * (barIndex + 0.5)) / 3, top: geo.top + plot.y + plot.height * (1 - (4 - item.result!.place) / 3) - 4 }
                      : { left: '50%', top: geo!.top - geo!.vmin * 2.5 }
                }
              />
            )}
          </>,
          host,
        )}

      <p className="text-[2vmin] font-semibold text-gold-400">Results so far</p>

      <ol aria-label="Results so far" className="flex flex-col border-t border-white/10">
        {rows.map((a) => {
          const out = shown.has(a.id)
          const now = a.id === item.id
          return (
            <li
              key={a.id}
              className={cn(
                'flex items-baseline gap-[1.6vmin] border-b border-white/10 py-[0.55vmin] pl-[1.4vmin] text-[2.4vmin]',
                now ? 'border-l-[0.4vmin] border-l-gold-400 pl-[1vmin] text-white' : out ? 'text-white/80' : 'text-white/35',
              )}
            >
              <span className={cn('w-[6.5vmin] shrink-0', now && 'font-semibold text-gold-400')}>{ordinal(a.result!.place)}</span>
              <span className="w-[7.5vmin] shrink-0 font-mono font-semibold tabular-nums">{out ? a.result!.backNumber : '—'}</span>
              <span className="truncate text-[2vmin]">{out ? a.result!.names.join(' & ') : ''}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function McHome() {
  const announcements = useAnnouncements()
  const data = announcements.data
  const competitions = useCompetitions()
  const [asked, setAsked] = useState(0)
  const [awake, setAwake] = useState(true)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
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

  if (announcements.isError) return <ErrorState onRetry={() => void announcements.refetch()} />

  if (!current) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[10vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
          {data ? 'Waiting for the next announcement' : ''}
        </h1>
      </div>
    )
  }

  const results = items.filter((a) => a.kind === 'result')
  const shown = new Set(items.slice(0, index + 1).filter((a) => a.kind === 'result').map((a) => a.id))

  return (
    <div ref={setHost} className={cn('relative flex flex-1 flex-col gap-[3.5vmin]', !awake && 'cursor-none')}>
      <div aria-hidden className="fixed inset-x-0 top-0 h-[0.5vmin] bg-white/10">
        <div className="h-full bg-gold-400 transition-[width] duration-300" style={{ width: `${((index + 1) / items.length) * 100}%` }} />
      </div>

      <div className="flex items-center justify-between gap-6">
        <img src={logo} alt="BIS" className="h-[7vmin] w-auto select-none rounded-[1.2vmin] bg-white px-[1.2vmin] py-[0.7vmin]" />
        <div className="flex items-baseline gap-[3vmin] text-[2.1vmin] font-medium text-brown-100">
          <span>{competitionName}</span>
          <span className="font-mono tabular-nums text-white" role="status">
            {index + 1} / {items.length}
          </span>
        </div>
      </div>

      <div key={current.kind === 'result' ? 'result' : current.id} className="flex flex-1 animate-fade-in flex-col gap-[3.5vmin]">
        <Heading item={current} />
        <View item={current} />
      </div>

      {current.kind === 'result' && <Board item={current} results={results} shown={shown} host={host} />}

      <nav
        aria-label="Announcer controls"
        className={cn(
          'fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-brown-950 px-[5vmin] py-3 text-small text-brown-100 transition-opacity duration-300',
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
                current.kind === m.kind ? 'font-semibold text-gold-400' : 'text-brown-100',
              )}
            >
              <span className="mr-2 font-mono text-xs opacity-70">{m.key}</span>
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
