import { ProgramStatus, pickCurrentCompetition, type Announcement, type Program } from '@bis/shared'
import { STAFF_SIGN_IN } from '../../app/nav.ts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, usePlotArea } from 'recharts'
import logo from '../../assets/logo.png'
import { ErrorState } from '../../components/ui/index.ts'
import { useAnnouncements, useCompetitions, useProgram, useCatalog } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances, ordinal } from '../../lib/format.ts'
import { AccountMenu } from '../../app/layouts/AccountMenu.tsx'
import { NotificationBell } from '../../app/layouts/NotificationBell.tsx'
import { useSignOut } from '../../app/useSignOut.ts'
import { useAuth } from '../../stores/auth.ts'
import { CompereLive } from './CompereLive.tsx'
import { FloorControl } from './CompereFloor.tsx'
import { RevealResults } from './CompereReveal.tsx'
import { HeatStrip, NextPanel } from './CompereNext.tsx'
import { usePaging } from './Pager.tsx'
import { CompereProgram } from './CompereProgram.tsx'
import { firstOpenCall, showRounds } from './rounds.ts'

// Built for an LED wall: every size is in vmin so it holds on 16:9 and ultra-wide, a deep brown ground with
// white type, no grey below brown-100 at half strength, and nothing thinner than a medium weight.

// Slide kinds are keys only: 1 to 3 are the places, 4 to 7 jump to a kind of slide
const MODES: Array<{ kind: Announcement['kind']; key: string }> = [
  { kind: 'call', key: '4' },
  { kind: 'recall', key: '5' },
  { kind: 'finalists', key: '6' },
  { kind: 'results', key: '7' },
]

type View = 'show' | 'program' | 'floor'
const TABS: Array<{ view: View; label: string; key: string }> = [
  { view: 'show', label: 'Show', key: '1' },
  { view: 'program', label: 'Program', key: '2' },
  { view: 'floor', label: 'Floor', key: '3' },
]

// Where the announcer is, kept on this device so a refresh or a dropped connection never loses the place
const PLACE_KEY = 'bis.compere.place'
const readPlace = () => {
  try {
    return localStorage.getItem(PLACE_KEY)
  } catch {
    return null
  }
}
const savePlace = (id: string) => {
  try {
    localStorage.setItem(PLACE_KEY, id)
  } catch {
    // Without storage the place is simply not kept
  }
}

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

// More numbers, smaller tiles; every size keeps a floor so a phone stays readable
function sheetSize(count: number) {
  if (count <= 12) return { cell: 'max(15vmin,5.5rem)', text: 'text-[max(3.6vmin,1.435rem)]', pad: 'py-[max(2vmin,0.9rem)]' }
  if (count <= 24) return { cell: 'max(11vmin,4.5rem)', text: 'text-[max(2.7vmin,1.23rem)]', pad: 'py-[max(1.4vmin,0.7rem)]' }
  return { cell: 'max(9vmin,4rem)', text: 'text-[max(2.2vmin,1.025rem)]', pad: 'py-[max(1vmin,0.5rem)]' }
}

// What to do with the numbers: the heat, then how many to select (or that it is a final); or how many came through
function instruction(a: Announcement): { heat: string; word: string; count: string } {
  const heat = a.kind === 'call' && a.heat ? String(a.heat) : ''
  if (a.kind === 'call') return a.select !== null ? { heat, word: 'Select', count: String(a.select) } : { heat, word: 'Final', count: '' }
  if (a.kind === 'recall') return { heat, word: 'Recalled', count: String(a.numbers.length) }
  return { heat, word: 'Finalists', count: String(a.numbers.length) }
}

function entrySize(count: number) {
  if (count <= 5) return { cols: '', number: 'text-[max(3.3vmin,1.435rem)]', name: 'text-[max(2vmin,0.922rem)]', team: 'text-[max(1.3vmin,0.717rem)]', pad: 'py-[max(1.3vmin,0.7rem)]', badge: 'max(12vmin,4.75rem)' }
  if (count <= 12) return { cols: 'md:grid-cols-2', number: 'text-[max(2.6vmin,1.23rem)]', name: 'text-[max(1.6vmin,0.82rem)]', team: 'text-[max(1.1vmin,0.688rem)]', pad: 'py-[max(1vmin,0.6rem)]', badge: 'max(10vmin,4rem)' }
  return { cols: 'md:grid-cols-2 xl:grid-cols-3', number: 'text-[max(2.2vmin,1.025rem)]', name: 'text-[max(1.3vmin,0.769rem)]', team: 'text-[max(0.9vmin,0.688rem)]', pad: 'py-[max(0.8vmin,0.5rem)]', badge: 'max(8vmin,3.5rem)' }
}

function EntryList({ entries }: { entries: Announcement['entries'] }) {
  const size = entrySize(entries.length)
  return (
    <ul aria-label="Competitors" className={cn('grid grid-cols-1 md:gap-x-[3vmin]', size.cols)}>
      {entries.map((e) => (
        <li key={e.backNumber} className={cn('flex items-center gap-[max(2.4vmin,1rem)] border-b border-white/10', size.pad)}>
          <span style={{ width: size.badge }} className={cn('shrink-0 font-mono font-semibold leading-none tabular-nums text-white', size.number)}>
            {String(e.backNumber).padStart(3, '0')}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate font-semibold leading-tight text-white', size.name)}>{e.names.join(' & ')}</span>
            <span className={cn('truncate font-medium text-brown-100', size.team)}>{e.teamName}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

const SMALL_LABEL = 'font-mono text-[max(1.1vmin,0.688rem)] font-medium uppercase tracking-[0.12em] text-brown-100'

// The sheet the announcer reads from: the event, what to do, the couples; the next event stays on the right
function Sheet({ item, items, program, onGo }: { item: Announcement; items: Announcement[]; program: Program | undefined; onGo: (id: string) => void }) {
  const { eventGrade } = useCatalog()
  const size = sheetSize(item.numbers.length)
  const todo = instruction(item)

  return (
    <div className="grid flex-1 grid-cols-1 content-start gap-x-[3.5vmin] gap-y-[5vmin] md:grid-cols-[minmax(0,1fr)_34vmin]">
      <div className="flex min-w-0 flex-col gap-[max(2.4vmin,1.1rem)]">
        <h1 className="sr-only">{EYEBROW[item.kind]}</h1>

        <div className="flex flex-wrap items-end justify-between gap-x-[4vmin] gap-y-[1.6vmin] border-b border-white/15 pb-[max(2vmin,0.9rem)]">
          <p className="flex min-w-0 flex-col gap-[0.8vmin]">
            <span className="flex flex-wrap items-baseline gap-x-[1.4vmin] text-[max(2.9vmin,1.23rem)] font-semibold leading-tight tracking-[-0.03em] text-white">
              <span className="font-mono font-medium tabular-nums text-gold-400">E{item.eventNumber}</span>
              {eventDances(item)}
            </span>
            <span className="text-[max(1.4vmin,0.717rem)] font-medium text-brown-100">
              {ROUND_TYPE_LABEL[item.roundType]} <span aria-hidden>·</span> {eventGrade(item)}
            </span>
          </p>

          <p aria-label="What to do" className="flex items-end gap-x-[max(4vmin,1.5rem)]">
            {todo.heat && (
              <span className="flex flex-col gap-[0.6vmin]">
                <span className={SMALL_LABEL}>{item.kind === 'call' && item.redance ? 'Redance, heat' : 'Heat'}</span>
                <span className="font-mono text-[max(3vmin,1.435rem)] font-semibold leading-none tabular-nums text-white">{todo.heat}</span>
              </span>
            )}
            {todo.count ? (
              <span className="flex flex-col gap-[0.6vmin]">
                <span className={SMALL_LABEL}>{todo.word}</span>
                <span className="font-mono text-[max(3vmin,1.435rem)] font-semibold leading-none tabular-nums text-white">{todo.count}</span>
              </span>
            ) : (
              <span className="text-[max(3vmin,1.435rem)] font-semibold leading-none text-white">{todo.word}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-[3vmin] gap-y-[1.4vmin] empty:hidden">
          <HeatStrip item={item} items={items} onGo={onGo} />
          <FloorControl item={item} program={program} />
        </div>

        {item.entries.length > 0 ? (
          <EntryList entries={item.entries} />
        ) : (
          <ul aria-label="Back numbers" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size.cell}, 1fr))` }} className="grid gap-[max(1.2vmin,0.5rem)]">
            {item.numbers.map((n) => (
              <li key={n} className={cn('rounded-[1vmin] bg-white/[0.06] text-center font-mono font-medium leading-none tabular-nums text-white', size.text, size.pad)}>
                {String(n).padStart(3, '0')}
              </li>
            ))}
          </ul>
        )}
      </div>
      <NextPanel item={item} items={items} program={program} onGo={onGo} />
    </div>
  )
}

// The slide says what is happening first, then which event it is about
function Heading({ item }: { item: Announcement }) {
  const { eventGrade } = useCatalog()
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
          {item.kind === 'call' ? `${item.redance ? 'Redance, heat' : 'Heat'} ${item.heat}` : `${item.numbers.length} competitors`}
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
  big: { box: 'translate(-50%, -50%) scale(1)', number: 'text-[26vmin]', name: 'text-[5vmin]', team: 'text-[2.6vmin]' },
  above: { box: 'translate(-50%, -100%) scale(1)', number: 'text-[7vmin]', name: 'text-[3vmin]', team: 'text-[2vmin]' },
  bar: { box: 'translate(-50%, -100%) scale(0.92)', number: 'text-[7vmin]', name: 'text-[3vmin]', team: 'text-[2vmin]' },
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
        <p className={cn('font-medium text-brown-100', look.team, ease)}>{result.teamName}</p>
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
  // One bar per placed couple: 2nd, 1st, 3rd with a clean podium, or left to right when places tie
  const top = board.filter((a) => a.result!.place <= 3)
  const podiumItems = top.length === 3 && top.every((a, i) => a.result!.place === i + 1) ? [top[1]!, top[0]!, top[2]!] : top
  const slots = Math.max(1, podiumItems.length)
  const slotOf = (id: string) => Math.max(0, podiumItems.findIndex((a) => a.id === id))
  const bars = podiumItems.map((a) => ({
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
  const barIndex = slotOf(item.id)
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
                <XAxis dataKey="id" tickFormatter={(id: string) => bars.find((b) => b.id === id)?.place ?? ''} axisLine={false} tickLine={false} interval={0} tick={{ fill: 'currentColor', fontSize: '1.8vmin' }} className="text-brown-100" />
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
                      left: geo.left + (geo.width * (slotOf(a.id) + 0.5)) / slots,
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
                    ? { left: geo.left + (geo.width * (barIndex + 0.5)) / slots, top: geo.top + plot.y + plot.height * (1 - (4 - item.result!.place) / 3) - 4 }
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

export function CompereHome() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut(STAFF_SIGN_IN)
  const announcements = useAnnouncements()
  const data = announcements.data
  const competitions = useCompetitions()
  // The announcer's own place, by slide id so it holds when slides come and go; until they move, the show is followed
  const [pinned, setPinned] = useState<string | null>(readPlace)
  // Show is the slides; Program and Floor are whole screens of their own, and any slide control brings the slides back
  const [view, setView] = useState<View>('show')
  const [awake, setAwake] = useState(true)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const items = useMemo(() => data ?? [], [data])
  const latest = pickCurrentCompetition(competitions.data ?? [])
  const competitionName = latest?.name
  const program = useProgram(latest?.id ?? '')
  const programRows = program.data?.rows ?? []
  const paging = usePaging(programRows.length, programRows.findIndex((r) => r.status === ProgramStatus.Current || r.status === ProgramStatus.Next), view === 'program')
  const rounds = useMemo(() => showRounds(items), [items])
  const pinnedAt = pinned ? items.findIndex((a) => a.id === pinned) : -1
  const index = pinnedAt >= 0 ? pinnedAt : firstOpenCall(items, program.data)
  const current = items[index]
  // Before the first announcement the running order is what the announcer needs, if there is one
  const showEvents = view === 'program'
  const showFloor = view === 'floor' || (view === 'show' && !current && (program.data?.rows.length ?? 0) > 0)
  const offSlides = showFloor || showEvents

  // Results that arrive while the announcer is elsewhere mark Program with a dot, until they look
  const resultsCount = items.filter((a) => a.kind === 'results').length
  const [seenCount, setSeenCount] = useState<number | null>(null)
  useEffect(() => {
    if (!data) return
    if (seenCount === null || view === 'program') setSeenCount(resultsCount)
  }, [data, resultsCount, view, seenCount])
  const newResults = seenCount !== null && resultsCount > seenCount && view !== 'program'

  // Results that get published bring the Results slide up by themselves while the live board is up
  const seenResults = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!data) return
    const ids = new Set(items.filter((a) => a.kind === 'results').map((a) => a.id))
    const seen = seenResults.current
    seenResults.current = ids
    if (!seen || view !== 'floor') return
    const fresh = items.find((a) => a.kind === 'results' && !seen.has(a.id))
    if (fresh) {
      setView('show')
      setPinned(fresh.id)
    }
  }, [data, items, view])

  const open = useCallback((id: string) => {
    setView('show')
    setPinned(id)
    savePlace(id)
  }, [])
  const go = useCallback(
    (to: number) => {
      const target = items[Math.max(0, Math.min(items.length - 1, to))]
      if (target) open(target.id)
    },
    [items, open],
  )
  const jump = useCallback(
    (kind: Announcement['kind']) => {
      // The next event is the first call not yet done; the others are the newest of their kind
      const at = kind === 'call' ? firstOpenCall(items, program.data) : items.findLastIndex((a) => a.kind === kind)
      if (at >= 0 && items[at]?.kind === kind) open(items[at]!.id)
    },
    [items, open, program.data],
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
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input,select,textarea')) return
      const mode = MODES.find((m) => m.key === e.key)
      const tab = TABS.find((x) => x.key === e.key)
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
      else if (tab) setView(tab.view)
      else if (e.key.toLowerCase() === 'f') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jump, fullscreen, index, items.length])

  // The controls stay on screen in every state, including while nothing is queued
  const controls = (
  <nav
    aria-label="Announcer controls"
    className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-3 whitespace-nowrap border-b border-white/10 bg-brown-950 px-[4.5vmin] text-small text-brown-100"
  >
    <div className="flex shrink-0 items-center gap-1">
      {TABS.map((x) => {
        const active = x.view === 'floor' ? showFloor : x.view === 'program' ? showEvents : !offSlides
        return (
          <button
            key={x.view}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setView(x.view)}
            className={cn('relative rounded-md px-3 py-2 transition-colors hover:text-white', active ? 'font-semibold text-gold-400' : 'text-brown-100')}
          >
            <span className="mr-2 font-mono text-xs opacity-70">{x.key}</span>
            {x.label}
            {x.view === 'program' && newResults && <span role="img" aria-label="New results" className="absolute right-1 top-1.5 size-2 rounded-full bg-gold-400" />}
          </button>
        )
      })}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      {!offSlides && (
        <p aria-label="Up next" className="mr-3 hidden items-baseline gap-2 border-r md:flex border-white/10 pr-4 text-small">
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
      <button type="button" aria-label="Previous announcement" disabled={items.length === 0 || (index === 0 && !offSlides)} onClick={() => go(index - 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <button type="button" aria-label="Next announcement" disabled={items.length === 0 || (index === items.length - 1 && !offSlides)} onClick={() => go(index + 1)} className="grid size-10 place-items-center rounded-md hover:text-white disabled:opacity-30">
        <ChevronRight aria-hidden className="size-5" />
      </button>
      <span aria-hidden className="mx-2 h-6 w-px bg-white/10" />
      <NotificationBell />
      {user && <AccountMenu name={user.name} profile={{ to: '/account', label: 'My account' }} onSignOut={signOut} />}
    </div>
  </nav>  )

  if (announcements.isError) {
    return (
      <div className="relative flex flex-1 flex-col">
        <ErrorState tone="dark" onRetry={() => void announcements.refetch()} />
        {controls}
      </div>
    )
  }

  if (!current && !showFloor && !showEvents) {
    return (
      <div className="relative flex flex-1 items-center">
        {controls}
        <h1 className="max-w-[18ch] text-balance text-[10vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
          {data ? 'Waiting for the next announcement' : ''}
        </h1>
      </div>
    )
  }

  const results = items.filter((a) => a.kind === 'result' && a.eventNumber === current.eventNumber && a.roundType === current.roundType)
  const shown = new Set(items.slice(0, index + 1).filter((a) => a.kind === 'result').map((a) => a.id))

  return (
    <div ref={setHost} className={cn('relative flex flex-1 flex-col gap-[3.5vmin]', !awake && 'cursor-none')}>
      {/* The fixed Up next panel takes the right edge of a sheet, so the name and the count stop at its left edge */}
      <div className={cn('flex items-center justify-between gap-6', !offSlides && current.kind !== 'result' && current.kind !== 'results' && 'md:pr-[37.5vmin]')}>
        <img src={logo} alt="BIS" className="h-[7vmin] w-auto select-none" />
        <div className="flex items-baseline gap-[3vmin] text-[2.1vmin] font-medium text-brown-100">
          <span>{competitionName}</span>
          {(!offSlides || (showEvents && paging.pages > 1)) && (
            <span className="font-mono tabular-nums text-white" role="status">
              {showEvents ? `${paging.page + 1} / ${paging.pages}` : `${index + 1} / ${items.length}`}
            </span>
          )}
        </div>
      </div>

      <RevealResults competitionId={latest?.id ?? ''} />

      {showEvents ? (
        <div key="program" className="flex flex-1 animate-fade-in flex-col gap-[2.4vmin]">
<CompereProgram full program={program.data} error={program.isError} rounds={rounds} paging={paging} onGo={open} />
        </div>
      ) : showFloor || !current ? (
        <div key="floor" className="flex flex-1 animate-fade-in flex-col gap-[4vmin]">
          <CompereLive competitionId={latest?.id ?? ''} quiet />
          <CompereProgram program={program.data} error={program.isError} />
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
              <Sheet item={current} items={items} program={program.data} onGo={open} />
            )}
          </div>

          {current.kind === 'result' && <Board item={current} results={results} shown={shown} host={host} />}
        </>
      )}

      {controls}
    </div>
  )
}
