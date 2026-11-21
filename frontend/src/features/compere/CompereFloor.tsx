import { ProgramKind, ProgramStatus, type Announcement, type Program } from '@bis/shared'
import { useState } from 'react'
import { useClearFloor, useStartRound } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'

const BUTTON = 'rounded-[0.8vmin] px-[1.6vmin] py-[1vmin] text-[2vmin] font-semibold transition-colors'

// The compere can put a round on the floor, or take it off, so the show goes on if the scrutineer's screen has a problem.
// It asks twice, so a stray tap never changes the floor.
export function FloorControl({ item, program }: { item: Announcement; program: Program | undefined }) {
  const start = useStartRound()
  const clear = useClearFloor()
  const [asking, setAsking] = useState(false)
  const status = program?.rows.find((r) => r.kind === ProgramKind.Round && r.eventNumber === item.eventNumber && r.roundType === item.roundType)?.status
  if (item.kind !== 'call' || status === ProgramStatus.Completed) return null

  const onFloor = status === ProgramStatus.Current
  const job = onFloor ? clear : start
  const error = (start.error ?? clear.error) as Error | null
  const run = () => {
    job.mutate(item.roundId, { onSuccess: () => setAsking(false) })
  }

  return (
    <div className="flex flex-wrap items-center gap-[1.4vmin]">
      <span className="font-mono text-[1.5vmin] font-medium uppercase tracking-[0.12em] text-brown-100">{onFloor ? 'On the floor' : 'Not started'}</span>
      {asking ? (
        <>
          <button type="button" disabled={job.isPending} onClick={run} className={cn(BUTTON, 'bg-gold-400 text-brown-950 hover:bg-gold-300')}>
            {onFloor ? 'Confirm: take off the floor' : 'Confirm: start this round'}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={cn(BUTTON, 'bg-white/[0.07] text-white hover:bg-white/15')}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={cn(BUTTON, 'bg-white/[0.07] text-white hover:bg-white/15')}>
          {onFloor ? 'Take off the floor' : 'Start round'}
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full text-[2vmin] font-medium text-white">
          {error.message}
        </p>
      )}
    </div>
  )
}
