import { ArrowRight } from 'lucide-react'
import { ProgramKind, ProgramStatus, type Announcement, type Program } from '@bis/shared'
import { StatusDot } from '../../components/StatusDot.tsx'
import { useCatalog } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances, formatClock } from '../../lib/format.ts'
import { roundKey, showRounds, type ShowRound } from './rounds.ts'

const STATE_LABEL: Record<ProgramStatus, string> = {
  [ProgramStatus.Current]: 'On the floor',
  [ProgramStatus.Next]: 'Next to the floor',
  [ProgramStatus.Upcoming]: 'Not started',
  [ProgramStatus.Completed]: 'Done',
}

const LABEL = 'font-mono text-[max(1.1vmin,0.688rem)] font-medium uppercase tracking-[0.12em] text-brown-100'

const CHIP = 'rounded-md px-[max(1.2vmin,0.625rem)] py-[max(0.5vmin,0.25rem)] text-[max(1.5vmin,0.75rem)] font-semibold tabular-nums transition-colors'

// Every heat of the round on screen, and its recalled slide, so the announcer sees them all and can jump to one
export function HeatStrip({ item, items, onGo }: { item: Announcement; items: Announcement[]; onGo: (id: string) => void }) {
  const round = showRounds(items).find((r) => r.key === roundKey(item))
  const heats = round?.heats ?? []
  const recall = round?.recall
  if (heats.length < 2 && !recall) return null
  return (
    <nav aria-label="Heats" className="flex flex-wrap items-center gap-[max(1.2vmin,0.5rem)]">
      {heats.map((h) => {
        const here = item.kind === 'call' && h.heat === item.heat
        return (
          <button key={h.id} type="button" aria-current={here ? 'true' : undefined} onClick={() => onGo(h.id)} className={cn(CHIP, here ? 'bg-gold-400 text-brown-950' : 'bg-white/[0.07] text-white hover:bg-white/15')}>
            Heat {h.heat}
          </button>
        )
      })}
      {recall && (
        <button type="button" aria-current={item.kind === 'recall' ? 'true' : undefined} onClick={() => onGo(recall.id)} className={cn(CHIP, item.kind === 'recall' ? 'bg-gold-400 text-brown-950' : 'bg-white/[0.07] text-white hover:bg-white/15')}>
          Recalled
        </button>
      )}
    </nav>
  )
}

function Numbers({ numbers }: { numbers: number[] }) {
  return <span className="font-mono text-[max(1.3vmin,0.688rem)] font-medium leading-snug tabular-nums text-white/80">{numbers.map((n) => String(n).padStart(3, '0')).join('  ')}</span>
}

function Details({ round, program, onGo }: { round: ShowRound; program: Program | undefined; onGo: (id: string) => void }) {
  const { eventGrade } = useCatalog()
  const row = program?.rows.find((r) => r.kind === ProgramKind.Round && r.eventNumber === round.eventNumber && r.roundType === round.roundType)
  const first = round.heats[0]
  const sample = round.sample
  const status = row?.status ?? ProgramStatus.Upcoming
  return (
    <div className="flex flex-col gap-[1.4vmin]">
      <p className="flex items-center gap-[1vmin] text-[max(1.3vmin,0.717rem)] font-medium text-brown-100">
        <StatusDot status={status} className="size-[max(1.1vmin,0.5rem)]" />
        <span className="text-white">{STATE_LABEL[status]}</span>
        {row?.startTime && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">{formatClock(row.startTime)}</span>
          </>
        )}
      </p>
      <p className="flex flex-col gap-[0.5vmin]">
        <span className="text-[max(1.9vmin,0.922rem)] font-semibold leading-tight text-white">
          <span className="mr-[1vmin] font-mono font-medium tabular-nums text-gold-400">E{round.eventNumber}</span>
          {eventDances(sample)}
        </span>
        <span className="text-[max(1.3vmin,0.717rem)] font-medium text-brown-100">
          {ROUND_TYPE_LABEL[round.roundType]} · {eventGrade(sample)}
          {sample.select !== null && ` · Select ${sample.select}`}
          {row && row.entryCount > 0 && ` · ${row.entryCount} entries`}
        </span>
      </p>
      {round.heats.length > 0 ? (
        <ul aria-label="Heats of the next event" className="flex flex-col">
          {round.heats.map((h) => (
            <li key={h.id} className="flex flex-col gap-[0.4vmin] border-t border-white/10 py-[1vmin]">
              <span className="flex items-center justify-between">
                <span className={LABEL}>{round.heats.length > 1 ? `Heat ${h.heat}` : 'All entries'}</span>
                <span className="font-mono text-[max(1.2vmin,0.688rem)] tabular-nums text-brown-100">{h.numbers.length}</span>
              </span>
              <Numbers numbers={h.numbers} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-white/10 pt-[1vmin] text-[max(1.3vmin,0.717rem)] font-medium text-brown-100">Who is in it is set once the round before is approved.</p>
      )}
      {first && (
        <button type="button" onClick={() => onGo(first.id)} className="group flex items-center gap-[1vmin] self-start py-[0.5vmin] text-[max(1.3vmin,0.717rem)] font-semibold text-white transition-colors hover:text-gold-400">
          Go to this event
          <ArrowRight aria-hidden className="size-[max(2vmin,1rem)] transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  )
}

const AFTER: Partial<Record<Announcement['kind'], string>> = { recall: 'Recalled', finalists: 'Finalists', results: 'Results', result: 'Results' }

// Past the calls the next one is a slide of another event, never a round still to dance
function NextResults({ next, onGo }: { next: Announcement; onGo: (id: string) => void }) {
  const { eventGrade } = useCatalog()
  return (
    <div className="flex flex-col gap-[1.4vmin]">
      <p className="flex items-center gap-[1vmin] text-[max(1.3vmin,0.717rem)] font-medium text-white">
        <StatusDot status={ProgramStatus.Next} className="size-[max(1.1vmin,0.5rem)]" />
        {AFTER[next.kind]}
      </p>
      <p className="flex flex-col gap-[0.5vmin]">
        <span className="text-[max(1.9vmin,0.922rem)] font-semibold leading-tight text-white">
          <span className="mr-[1vmin] font-mono font-medium tabular-nums text-gold-400">E{next.eventNumber}</span>
          {eventDances(next)}
        </span>
        <span className="text-[max(1.3vmin,0.717rem)] font-medium text-brown-100">
          {ROUND_TYPE_LABEL[next.roundType]} · {eventGrade(next)}
        </span>
      </p>
      <button type="button" onClick={() => onGo(next.id)} className="group flex items-center gap-[1vmin] self-start py-[0.5vmin] text-[max(1.3vmin,0.717rem)] font-semibold text-white transition-colors hover:text-gold-400">
        Go to this event
        <ArrowRight aria-hidden className="size-[max(1.4vmin,0.75rem)] transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}

// The event after this one, with all its details, kept on the right so it is there on a tablet too
export function NextPanel({ item, items, program, onGo }: { item: Announcement; items: Announcement[]; program: Program | undefined; onGo: (id: string) => void }) {
  const rounds = showRounds(items).filter((r) => r.heats.length > 0 || r.sample.kind === 'call')
  const at = rounds.findIndex((r) => r.key === roundKey(item))
  const next = rounds[at + 1]
  // Past the calls: the first later slide of another event or round
  const here = items.findIndex((a) => a.id === item.id)
  const after = item.kind === 'call' ? undefined : items.slice(here + 1).find((a) => roundKey(a) !== roundKey(item))
  return (
    <aside aria-label="Up next event" className="flex min-w-0 flex-col gap-[1.6vmin] border-t border-white/15 pt-[2.4vmin] md:fixed md:bottom-0 md:right-0 md:top-14 md:z-20 md:w-[38.5vmin] md:overflow-y-auto md:border-l md:border-t-0 md:bg-brown-950 md:py-[3vmin] md:pl-[2.4vmin] md:pr-[4.5vmin]">
      <h2 className={LABEL}>Up next</h2>
      {item.kind !== 'call' ? (
        after ? <NextResults next={after} onGo={onGo} /> : <p className="text-[max(1.4vmin,0.769rem)] font-medium text-white/60">None after this one</p>
      ) : next ? (
        <Details round={next} program={program} onGo={onGo} />
      ) : (
        <p className="text-[max(1.4vmin,0.769rem)] font-medium text-white/60">None after this one</p>
      )}
    </aside>
  )
}
