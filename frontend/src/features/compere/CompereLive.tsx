import { SubmissionStatus, type RoundRow } from '@bis/shared'
import { useCatalog, useCompetitionRounds, useLiveSubmissions } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { ROUND_TYPE_LABEL, eventDances } from '../../lib/format.ts'

// One round on the floor: how many adjudicators have sent their marks, never the marks themselves
function Card({ row, alone }: { row: RoundRow; alone: boolean }) {
  const { eventGrade } = useCatalog()
  const submissions = useLiveSubmissions(row.roundId)
  const total = submissions.length
  const sent = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length
  const done = total > 0 && sent === total

  return (
    <section aria-label={`E${row.eventNumber}`} className="flex min-w-0 flex-col justify-between gap-[3vmin] border-t border-white/20 pt-[2.4vmin]">
      <div className="flex flex-col gap-[1.2vmin]">
        <p className="flex items-baseline gap-[1.6vmin] font-mono text-[2.4vmin] font-medium uppercase tracking-[0.12em] text-brown-100">
          <span className="tabular-nums text-gold-400">E{row.eventNumber}</span>
          {ROUND_TYPE_LABEL[row.type]}
        </p>
        <h2 className={cn('text-balance font-semibold leading-[1.05] tracking-[-0.03em] text-white', alone ? 'text-[8vmin]' : 'text-[5.2vmin]')}>{eventDances(row)}</h2>
        <p className="text-[2.4vmin] font-medium text-brown-100">{eventGrade({ ageGroup: row.ageGroup, class: row.class, discipline: row.discipline })}</p>
      </div>

      <div className="flex flex-col gap-[1.6vmin]">
        <p className="flex items-baseline gap-[1.4vmin] text-white" role="status">
          <span className={cn('font-mono font-semibold tabular-nums', alone ? 'text-[12vmin]' : 'text-[8vmin]', done && 'text-gold-400')}>{sent}</span>
          <span className="text-[3vmin] font-medium text-brown-100">of {total} adjudicators</span>
        </p>
        <div aria-hidden className="flex gap-[0.8vmin]">
          {submissions.map((s) => (
            <span key={s.adjudicatorId} className={cn('h-[1.2vmin] flex-1 rounded-full transition-colors duration-500', s.status === SubmissionStatus.Submitted ? 'bg-gold-400' : 'bg-white/15')} />
          ))}
        </div>
        <p className={cn('text-[2.6vmin] font-medium', done ? 'text-gold-400' : 'text-brown-100')}>{done ? 'All marks in. Results coming.' : 'Adjudicators are marking'}</p>
      </div>
    </section>
  )
}

// The rounds on the floor side by side, for the wall while the announcer waits for the results
export function CompereLive({ competitionId }: { competitionId: string }) {
  const rounds = useCompetitionRounds(competitionId)
  const onFloor = (rounds.data ?? []).filter((r) => r.onFloor)

  if (onFloor.length === 0) {
    return (
      <div className="flex flex-1 items-center">
        <h1 className="max-w-[18ch] text-balance text-[8vmin] font-semibold leading-[1.02] tracking-[-0.035em] text-white">{rounds.data ? 'No round is on the floor' : ''}</h1>
      </div>
    )
  }

  return (
    <div className={cn('grid flex-1 content-center gap-x-[4vmin] gap-y-[5vmin]', onFloor.length === 1 ? 'grid-cols-1' : onFloor.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {onFloor.map((row) => (
        <Card key={row.roundId} row={row} alone={onFloor.length === 1} />
      ))}
    </div>
  )
}
