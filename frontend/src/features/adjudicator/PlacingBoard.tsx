import type { MarkingCompetitor } from '@bis/shared'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { cn } from '../../lib/cn.ts'
import { ordinal } from '../../lib/format.ts'
import { tile, tileOff } from './tile.ts'

interface PlacingBoardProps {
  competitors: MarkingCompetitor[]
  // Competitor ids from 1st place down
  ranking: string[]
  onChange: (ranking: string[]) => void
}

const control =
  'grid size-14 place-items-center rounded-xl bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200/70 active:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-30'

// Tap a back number to give it the next place; move or remove it from the list below
export function PlacingBoard({ competitors, ranking, onChange }: PlacingBoardProps) {
  const byId = new Map(competitors.map((c) => [c.id, c]))
  const unplaced = competitors.filter((c) => !ranking.includes(c.id))

  const move = (index: number, by: -1 | 1) => {
    const next = [...ranking]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {unplaced.length > 0 ? `Tap for ${ordinal(ranking.length + 1)} place` : 'Everyone is placed'}
        </h3>
        {unplaced.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-3">
            {unplaced.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-label={`Place ${c.backNumber}`}
                  onClick={() => onChange([...ranking, c.id])}
                  className={cn(tile, tileOff, 'w-full')}
                >
                  {c.backNumber ?? '–'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ranking.length > 0 && (
        <ol aria-label="Your placings" className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {ranking.map((id, i) => (
            <li key={id} className="flex items-center gap-2.5 border-b border-neutral-100 p-2.5 last:border-b-0">
              <span className="grid h-9 w-12 shrink-0 place-items-center rounded-full bg-gold-100 text-small font-semibold text-gold-700">
                {ordinal(i + 1)}
              </span>
              <span className="flex-1 pl-1 font-mono text-2xl font-medium tabular-nums">{byId.get(id)?.backNumber ?? '–'}</span>
              <button type="button" aria-label={`Move ${byId.get(id)?.backNumber} up`} disabled={i === 0} onClick={() => move(i, -1)} className={control}>
                <ArrowUp aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${byId.get(id)?.backNumber} down`}
                disabled={i === ranking.length - 1}
                onClick={() => move(i, 1)}
                className={control}
              >
                <ArrowDown aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${byId.get(id)?.backNumber} from placings`}
                onClick={() => onChange(ranking.filter((x) => x !== id))}
                className={control}
              >
                <X aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
