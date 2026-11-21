import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ShowRound } from './rounds.ts'

const pad = (n: number) => String(n).padStart(3, '0')

function Open({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group ml-auto flex items-center gap-[0.8vmin] text-[max(1.7vmin,0.8125rem)] font-semibold text-brown-100 transition-colors hover:text-gold-400">
      {label}
      <ArrowRight aria-hidden className="size-[max(1.8vmin,0.875rem)] transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function Group({ title, count, action, children }: { title: string; count?: number; action: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[max(1.2vmin,0.5rem)]">
      <h3 className="flex items-baseline gap-[1.2vmin] text-[max(1.8vmin,0.875rem)] font-semibold text-white">
        {title}
        {count !== undefined && <span className="font-mono text-[max(1.5vmin,0.75rem)] font-medium tabular-nums text-brown-100">{count} entries</span>}
        {action}
      </h3>
      {children}
    </section>
  )
}

function Chips({ numbers }: { numbers: number[] }) {
  return (
    <ul className="flex flex-wrap gap-[max(0.8vmin,0.375rem)]">
      {numbers.map((n) => (
        <li key={n} className="rounded-[0.8vmin] bg-white/[0.04] px-[max(1.2vmin,0.5rem)] py-[max(0.6vmin,0.25rem)] font-mono text-[max(2vmin,0.875rem)] font-medium tabular-nums text-white">
          {pad(n)}
        </li>
      ))}
    </ul>
  )
}

// Every heat with its entries, who came through and the results as they arrive; each opens its slide
export function RoundDetail({ round, onGo }: { round: ShowRound; onGo: (id: string) => void }) {
  const placed = [...round.results].sort((a, b) => a.result!.place - b.result!.place)
  return (
    <div className="mx-[max(2vmin,0.75rem)] mb-[1vmin] mt-[0.4vmin] flex flex-col gap-[max(2.4vmin,1rem)] rounded-[1vmin] bg-white/[0.02] p-[max(2vmin,0.875rem)]">
      {round.heats.map((h) => (
        <Group
          key={h.id}
          title={round.heats.length > 1 ? `Heat ${h.heat}` : round.sample.select === null ? 'Finalists' : 'All entries'}
          count={h.numbers.length}
          action={<Open label="Open" onClick={() => onGo(h.id)} />}
        >
          <Chips numbers={h.numbers} />
        </Group>
      ))}
      {round.recall && (
        <Group title="Recalled to the next round" count={round.recall.numbers.length} action={<Open label="Open" onClick={() => onGo(round.recall!.id)} />}>
          <Chips numbers={round.recall.numbers} />
        </Group>
      )}
      {placed.length > 0 && (
        <Group title="Results" action={<Open label="Open results" onClick={() => onGo(round.finalists?.id ?? placed[0]!.id)} />}>
          <ol className="grid grid-cols-1 gap-x-[3vmin] md:grid-cols-2">
            {placed.map((r) => (
              <li key={r.id} className="flex items-baseline gap-[max(1.6vmin,0.75rem)] border-b border-white/10 py-[max(0.7vmin,0.35rem)] text-[max(1.9vmin,0.875rem)] font-medium text-white">
                <span className="w-[5vmin] font-mono tabular-nums text-gold-400">{r.result!.place}</span>
                <span className="font-mono font-semibold tabular-nums">{r.result!.backNumber === null ? '—' : pad(r.result!.backNumber)}</span>
                <span className="truncate text-brown-100">{r.result!.names.join(' & ')}</span>
              </li>
            ))}
          </ol>
        </Group>
      )}
      {round.heats.length === 0 && !round.recall && placed.length === 0 && <p className="text-[max(1.8vmin,0.875rem)] font-medium text-brown-100">Nothing to announce yet.</p>}
    </div>
  )
}
