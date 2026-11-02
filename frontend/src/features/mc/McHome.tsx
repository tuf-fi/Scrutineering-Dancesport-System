import type { Announcement } from '@bis/shared'
import { STAFF_SIGN_IN } from '../../app/nav.ts'
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, usePlotArea } from 'recharts'
import logo from '../../assets/logo.png'
import { ErrorState } from '../../components/ui/index.ts'
import { useAnnouncements, useCompetitions, useProgram } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances, eventGrade, ordinal } from '../../lib/format.ts'
import { AccountMenu } from '../../app/layouts/AccountMenu.tsx'
import { useSignOut } from '../../app/useSignOut.ts'
import { useAuth } from '../../stores/auth.ts'
import { McProgram } from './McProgram.tsx'

// Built for an LED wall: every size is in vmin so it holds on 16:9 and ultra-wide, a deep brown ground with
// white type, no grey below brown-100 at half strength, and nothing thinner than a medium weight.

const MODES: Array<{ kind: Announcement['kind']; label: string; key: string }> = [
  { kind: 'call', label: 'Next event', key: '1' },
  { kind: 'recall', label: 'Recalled', key: '2' },
  { kind: 'finalists', label: 'Finalists', key: '3' },
  { kind: 'results', label: 'Results', key: '4' },
]

const PROGRAM_KEY = '5'

const EYEBROW: Record<Announcement['kind'], string> = {
  call: 'Next to the floor',
  recall: 'Recalled to the next round',
  finalists: 'Finalists',
  results: 'Results',
  result: 'Results',
}

// What a screen is called, so the announcer knows what the next one is before pressing next
const SCREEN: Record<Announcement['kind'], string> = {
  call: 'Next event',
  recall: 'Recalled',
  finalists: 'Finalists',
  results: 'Results',
  result: 'Result',
}
const screenName = (a: Announcement) => (a.kind === 'result' ? `${ordinal(a.result!.place)} place` : SCREEN[a.kind])

// 3rd to 1st place: the podium slides
const isPodium = (item: Announcement) => item.kind === 'result' && item.result!.place <= 3

// Says what the back numbers on a slide are for
const NUMBERS_FOR: Record<Announcement['kind'], string> = {
  call: 'Back numbers to the floor',
  recall: 'Back numbers recalled',
  finalists: 'Back numbers in the final',
  results: '',
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

// The sheet the announcer reads from, drawn as a table: the event, the next event, the back numbers in a grid and what to do with them
function nextEventOf(items: Announcement[], index: number): Announcement | undefined {
  const here = items[index]
  return items.slice(index + 1).find((a) => a.kind !== 'result' && (a.eventNumber !== here?.eventNumber || a.roundType !== here?.roundType))
}

// More numbers, more columns and smaller type, so a long list still fits the wall
function sheetSize(count: number) {
  if (count <= 12) return { columns: 4, text: 'text-[7vmin]', pad: 'py-[2.6vmin]' }
  if (count <= 24) return { columns: 6, text: 'text-[5vmin]', pad: 'py-[1.8vmin]' }
  return { columns: 8, text: 'text-[3.8vmin]', pad: 'py-[1.3vmin]' }
}

// What to do with the numbers: the heat, then how many to select (or that it is a final); or how many came through
function instruction(a: Announcement): { heat: string; word: string; count: string } {
  const heat = a.kind === 'call' && a.heat ? String(a.heat) : ''
  if (a.kind === 'call') return a.select !== null ? { heat, word: 'Select', count: String(a.select) } : { heat, word: 'Final', count: '' }
  if (a.kind === 'recall') return { heat, word: 'Recalled', count: String(a.numbers.length) }
  return { heat, word: 'Finalists', count: String(a.numbers.length) }
}

const LABEL = 'font-mono text-[1.9vmin] font-medium uppercase tracking-[0.12em] text-brown-100'

// The sheet the announcer reads from: the event and the one after it, the back numbers as tiles, and what to do with them
function Sheet({ item, next }: { item: Announcement; next: Announcement | undefined }) {
  const size = sheetSize(item.numbers.length)
  const todo = instruction(item)

  return (
    <div className="flex flex-1 flex-col gap-[3.5vmin]">
      <h1 className="sr-only">{EYEBROW[item.kind]}</h1>

      <header className="flex flex-col gap-[2.2vmin]">
        <div className="flex flex-col gap-[1vmin]">
          <span className={LABEL}>Event</span>
          <p className="flex flex-wrap items-baseline gap-x-[2.4vmin] gap-y-[0.6vmin]">
            <span className="flex items-baseline gap-[1.8vmin] text-[5.6vmin] font-semibold leading-none tracking-[-0.03em] text-white">
              <span className="font-mono font-medium tabular-nums text-gold-400">E{item.eventNumber}</span>
              {eventDances(item)}
            </span>
            <span className="text-[2.6vmin] font-medium text-brown-100">
              {ROUND_TYPE_LABEL[item.roundType]} <span aria-hidden>·</span> {eventGrade(item)}
            </span>
          </p>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-[2vmin] gap-y-[0.6vmin] border-t border-white/10 pt-[2vmin]">
          <span className={LABEL}>Next event</span>
          {next ? (
            <span className="text-[2.8vmin] font-medium text-white/80">
              <span className="mr-[1.2vmin] font-mono tabular-nums text-gold-400">E{next.eventNumber}</span>
              {eventDances(next)}
              <span className="ml-[1.2vmin] text-brown-100">
                {ROUND_TYPE_LABEL[next.roundType]} <span aria-hidden>·</span> {eventGrade(next)}
              </span>
            </span>
          ) : (
            <span className="text-[2.8vmin] font-medium text-white/50">–</span>
          )}
        </p>
      </header>

      {/* Square cells split by hairlines. A last row with fewer numbers starts at the left; there are no empty cells. */}
      <ul aria-label="Back numbers" className="flex flex-wrap pl-px pt-px">
        {item.numbers.map((n) => (
          <li
            key={n}
            style={{ width: `calc(100% / ${size.columns})` }}
            className={cn('-ml-px -mt-px border border-white/15 text-center font-mono font-medium leading-none tabular-nums text-white', size.text, size.pad)}
          >
            {String(n).padStart(3, '0')}
          </li>
        ))}
      </ul>

      <p aria-label="What to do" className="mt-auto flex flex-wrap items-baseline gap-x-[6vmin] gap-y-[1vmin] border-t border-white/10 pt-[2.2vmin]">
        {todo.heat && (
          <span className="flex items-baseline gap-[1.8vmin]">
            <span className={LABEL}>Heat</span>
            <span className="font-mono text-[6vmin] font-semibold leading-none tabular-nums text-white">{todo.heat}</span>
          </span>
        )}
        <span className="flex items-baseline gap-[1.8vmin]">
          <span className={LABEL}>{todo.word}</span>
          {todo.count && <span className="font-mono text-[6vmin] font-semibold leading-none tabular-nums text-gold-400">{todo.count}</span>}
        </span>
      </p>
    </div>
  )
}

// The slide says what is happening first, then which event it is about
function Heading({ item }: { item: Announcement }) {
  const centred = item.kind === 'result' || item.kind === 'results'
  const message = item.kind === 'result' ? `${ordinal(item.result!.place)} place` : EYEBROW[item.kind]
  return (
    <header className={cn('pointer-events-none relative z-50 flex flex-col gap-[2vmin]', centred && 'items-center text-center')}>
      <h1 className={cn('font-semibold leading-none tracking-[-0.035em] text-white transition-[font-size] duration-700 ease-in-out motion-reduce:transition-none', item.kind === 'results' ? 'text-[16vmin]' : centred ? 'text-[5.5vmin]' : 'text-[11vmin]')}>
        {item.kind === 'result' ? (
          <>
            <span className="text-gold-400">{ordinal(item.result!.place)}</span> place
          </>
        ) : (
          message
        )}
      </h1>
      <div className={cn('flex flex-col gap-x-[2.4vmin] gap-y-[0.8vmin]', centred && 'items-center')}>
        <p className={cn('flex items-baseline gap-[1.6vmin] font-semibold text-white', centred ? 'text-[2.4vmin]' : 'text-[4vmin]')}>
          <span className="font-mono font-medium tabular-nums text-gold-400">E{item.eventNumber}</span>
          {eventDances(item)}
        </p>
        <p className={cn('font-medium text-brown-100', centred ? 'text-[1.8vmin]' : 'text-[2.6vmin]')}>
          {ROUND_TYPE_LABEL[item.roundType]} · {eventGrade(item)}
        </p>
      </div>
    </header>
  )
}

function View({ item }: { item: Announcement }) {
  // The winner block is drawn by the board, which moves it from here onto the podium
  if (item.kind === 'result') return <div data-hero-zone className="flex-1" />
  // The slide before the first place: only the word and the event
  if (item.kind === 'results') return <div className="flex-1" />

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
  above: { box: 'translate(-50%, -100%) scale(1)', number: 'text-[7vmin]', name: 'text-[3vmin]', club: 'text-[2vmin]' },
  bar: { box: 'translate(-50%, -100%) scale(0.92)', number: 'text-[7vmin]', name: 'text-[3vmin]', club: 'text-[2vmin]' },
} as const

function WinnerBlock({ result, phase, style, still = false, raised = false }: { result: NonNullable<Announcement['result']>; phase: keyof typeof BLOCK; style: { left: number | string; top: number | string }; still?: boolean; raised?: boolean }) {
  const look = BLOCK[phase]
  const ease = still ? '' : 'transition-[font-size] duration-[900ms] ease-in-out motion-reduce:transition-none'
  return (
    <div
      className={cn(
        'pointer-events-none absolute flex origin-bottom flex-col items-center whitespace-nowrap text-center motion-reduce:transition-none',
        raised && 'z-50',
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

// The results. They sit at the bottom right while the lower places are read, then slide to the bottom left for
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
  // The rows of 1st to 3rd slowly fade out and fold away where they are, while the bars come up on the left
  const rows = board

  // The new block is announced big first, then flies to its bar
  const [plot, setPlot] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const place = item.result!.place
  const [placedFor, setPlacedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!podium) return
    // Every place is read at the centre for two seconds first; only then does the name move onto its bar
    const timer = setTimeout(() => setPlacedFor(item.id), 2000)
    return () => clearTimeout(timer)
  }, [podium, item.id, place])
  const chartRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<{ top: number; left: number; width: number; vmin: number } | null>(null)
  useLayoutEffect(() => {
    if (!podium || !host || !chartRef.current) return
    const vmin = Math.min(window.innerWidth, window.innerHeight) / 100
    const chart = chartRef.current.getBoundingClientRect()
    const room = host.getBoundingClientRect()
    setGeo({ top: chart.top - room.top, left: chart.left - room.left, width: chart.width, vmin })
  }, [podium, host, plot])
  const barIndex = Math.max(0, [2, 1, 3].indexOf(item.result!.place))
  // The winner is at the centre until it flies to its bar
  const atCentre = podium && !(placedFor === item.id && plot && geo)
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
    <>
      {/* For 1st to 3rd the bars stand on the left and run across to the results list on the right */}
      {podium && (
        <div className="absolute bottom-0 left-0" style={{ width: 'calc(100% - 48vmin)' }}>
          <div ref={chartRef} aria-hidden className="relative animate-fade-in" style={{ height: '40vmin' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="6%">
                <PlotProbe onPlot={setPlot} />
                <YAxis hide domain={[0, 3]} />
                <XAxis dataKey="place" axisLine={false} tickLine={false} interval={0} tick={{ fill: 'currentColor', fontSize: '1.8vmin' }} className="text-brown-100" />
                <Bar dataKey="height" radius={0}>
                  {bars.map((d) => (
                    <Cell key={d.id} style={{ fill: d.now ? 'var(--color-gold-400)' : d.out ? 'rgb(255 255 255 / 0.28)' : 'rgb(255 255 255 / 0.08)' }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    <div className="absolute bottom-0 flex flex-col gap-[1vmin]" style={{ left: '100%', transform: 'translateX(-100%)', width: '44vmin' }}>
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
            {/* While a winner is shown at the centre, everything but the heading and the winner is dimmed: the navbar, the logo row, the bars and the blocks on them */}
            {podium && zone && (
              <div
                aria-hidden
                className={cn('pointer-events-none fixed inset-0 z-40 bg-brown-950/85 transition-opacity duration-700 ease-in-out motion-reduce:transition-none', atCentre ? 'opacity-100' : 'opacity-0')}
              />
            )}
            {zone && (
              <WinnerBlock
                raised
                key={item.result!.place < 3 ? item.id : 'hero'}
                result={item.result!}
                phase={podium && placedFor === item.id && plot && geo ? 'bar' : 'big'}
                style={
                  podium && placedFor === item.id && plot && geo
                    ? { left: geo.left + (geo.width * (barIndex + 0.5)) / 3, top: geo.top + plot.y + plot.height * (1 - (4 - item.result!.place) / 3) - 4 }
                    : { left: zone.x, top: zone.y }
                }
              />
            )}
          </>,
          host,
        )}

      <p className="font-mono text-[1.9vmin] font-medium uppercase tracking-[0.12em] text-brown-100">Results</p>

      <ol aria-label="Results" className="flex flex-col border-t border-white/15">
        {rows.map((a) => {
          const out = shown.has(a.id)
          const now = a.id === item.id
          return (
            <li
              key={a.id}
              className={cn(
                'grid grid-cols-[7vmin_9vmin_minmax(0,1fr)] items-baseline gap-x-[1.6vmin] overflow-hidden border-b border-white/10 px-[1.6vmin] text-[2.6vmin] transition-[opacity,max-height,padding,border-color,background-color] duration-[1800ms] ease-in-out motion-reduce:transition-none',
                podium && a.result!.place <= 3
                  ? 'max-h-0 border-transparent py-0 opacity-0'
                  : 'max-h-[9vmin] py-[1.1vmin]',
                now ? 'bg-gold-400/10 text-white' : out ? 'text-white/85' : 'text-white/30',
              )}
            >
              <span className={cn('font-mono text-[2.2vmin] font-medium tabular-nums', now ? 'text-gold-400' : 'text-brown-100')}>{ordinal(a.result!.place)}</span>
              <span className="font-mono font-semibold tabular-nums">{out ? String(a.result!.backNumber ?? '').padStart(3, '0') : '—'}</span>
              <span className="truncate text-[2.2vmin] font-medium">{out ? a.result!.names.join(' & ') : ''}</span>
            </li>
          )
        })}
      </ol>
    </div>
    </>
  )
}

export function McHome() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut(STAFF_SIGN_IN)
  const announcements = useAnnouncements()
  const data = announcements.data
  const competitions = useCompetitions()
  const [asked, setAsked] = useState(0)
  // Key 5 shows the running order instead of a slide; any slide control brings the slides back
  const [view, setView] = useState<'slides' | 'program'>('slides')
  const [awake, setAwake] = useState(true)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const items = useMemo(() => data ?? [], [data])
  const index = Math.min(asked, Math.max(0, items.length - 1))
  const current = items[index]
  const latest = [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]
  const competitionName = latest?.name
  const program = useProgram(latest?.id ?? '')
  // Before the first announcement the running order is what the announcer needs, if there is one
  const showProgram = view === 'program' || (!current && (program.data?.rows.length ?? 0) > 0)

  const go = useCallback(
    (to: number) => {
      setView('slides')
      setAsked(Math.max(0, Math.min(items.length - 1, to)))
    },
    [items.length],
  )
  const jump = useCallback(
    (kind: Announcement['kind']) => {
      const first = items.findIndex((a) => a.kind === kind)
      if (first >= 0) {
        setView('slides')
        setAsked(first)
      }
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
      else if (e.key === PROGRAM_KEY) setView('program')
      else if (e.key.toLowerCase() === 'f') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jump, fullscreen, index, items.length])

  if (announcements.isError) return <ErrorState onRetry={() => void announcements.refetch()} />

  if (!current && !showProgram) {
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
      {!showProgram && (
        <div aria-hidden className="fixed inset-x-0 top-0 h-[0.5vmin] bg-white/10">
          <div className="h-full bg-gold-400 transition-[width] duration-300" style={{ width: `${((index + 1) / items.length) * 100}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between gap-6">
        <img src={logo} alt="BIS" className="h-[7vmin] w-auto select-none" />
        <div className="flex items-baseline gap-[3vmin] text-[2.1vmin] font-medium text-brown-100">
          <span>{competitionName}</span>
          {!showProgram && (
            <span className="font-mono tabular-nums text-white" role="status">
              {index + 1} / {items.length}
            </span>
          )}
        </div>
      </div>

      {showProgram || !current ? (
        <div key="program" className="flex flex-1 animate-fade-in flex-col">
          <McProgram program={program.data} error={program.isError} />
        </div>
      ) : (
        <>
          <div key={current.kind === 'result' ? 'result' : current.id} className={cn('flex flex-1 animate-fade-in flex-col gap-[3.5vmin]', current.kind === 'result' && '-mt-[9vmin]')}>
            {current.kind === 'results' ? (
              // The slide that says it is time for the results: the word and the event, in the middle of the screen
              <div className="flex flex-1 items-center justify-center">
                <Heading item={current} />
              </div>
            ) : current.kind === 'result' ? (
              <>
                <Heading item={current} />
                <View item={current} />
              </>
            ) : (
              <Sheet item={current} next={nextEventOf(items, index)} />
            )}
          </div>

          {current.kind === 'result' && <Board item={current} results={results} shown={shown} host={host} />}
        </>
      )}

      <nav
        aria-label="Announcer controls"
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-brown-950 px-[4.5vmin] text-small text-brown-100"
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
                !showProgram && (current?.kind === 'result' ? 'results' : current?.kind) === m.kind ? 'font-semibold text-gold-400' : 'text-brown-100',
              )}
            >
              <span className="mr-2 font-mono text-xs opacity-70">{m.key}</span>
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView('program')}
            className={cn('rounded-md px-3 py-2 transition-colors hover:text-white', showProgram ? 'font-semibold text-gold-400' : 'text-brown-100')}
          >
            <span className="mr-2 font-mono text-xs opacity-70">{PROGRAM_KEY}</span>
            Program
          </button>
        </div>
        <div className="flex items-center gap-1">
          {!showProgram && (
            <p aria-label="Up next" className="mr-3 flex items-baseline gap-2 border-r border-white/10 pr-4 text-small">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-brown-100">Up next</span>
              {items[index + 1] ? (
                <span className="font-semibold text-white">
                  {screenName(items[index + 1]!)}
                  <span className="ml-2 font-mono text-xs font-medium tabular-nums text-gold-400">E{items[index + 1]!.eventNumber}</span>
                </span>
              ) : (
                <span className="font-medium text-white/50">End</span>
              )}
            </p>
          )}
          <button type="button" aria-label="Previous announcement" disabled={items.length === 0 || (index === 0 && !showProgram)} onClick={() => go(index - 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label="Next announcement" disabled={items.length === 0 || (index === items.length - 1 && !showProgram)} onClick={() => go(index + 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label="Full screen" onClick={fullscreen} className="grid size-10 place-items-center rounded-md hover:text-white">
            <Maximize aria-hidden className="size-4" />
          </button>
          <span aria-hidden className="mx-2 h-6 w-px bg-white/10" />
          {user && <AccountMenu name={user.name} profile={{ to: '/account', label: 'My account' }} onSignOut={signOut} />}
        </div>
      </nav>
    </div>
  )
}
