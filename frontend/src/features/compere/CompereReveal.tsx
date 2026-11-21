import { useState } from 'react'
import { useResultsRelease, useRevealResults } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'

const BUTTON = 'rounded-[0.8vmin] px-[max(1.6vmin,0.75rem)] py-[max(0.8vmin,0.4rem)] text-[max(1.5vmin,0.8125rem)] font-semibold transition-colors'

// While results are held until the awarding, the compere can release them, so the awarding never waits on the scrutineer.
// It asks twice, and only shows while there are finals waiting.
export function RevealResults({ competitionId }: { competitionId: string }) {
  const release = useResultsRelease(competitionId)
  const reveal = useRevealResults()
  const [asking, setAsking] = useState(false)
  const data = release.data
  if (!data?.hold || data.revealedAt || data.waiting === 0) return null
  const error = reveal.error as Error | null

  return (
    <div className="flex flex-wrap items-center gap-x-[2vmin] gap-y-[1vmin]">
      <p className="text-[max(1.5vmin,0.8125rem)] font-medium text-brown-100">
        <span className="font-semibold text-white">Results held for the awarding.</span> {data.waiting} {data.waiting === 1 ? 'final is' : 'finals are'} waiting.
      </p>
      {asking ? (
        <>
          <button type="button" disabled={reveal.isPending} onClick={() => reveal.mutate(competitionId, { onSuccess: () => setAsking(false) })} className={cn(BUTTON, 'bg-gold-400 text-brown-950 hover:bg-gold-300')}>
            Confirm: reveal the results
          </button>
          <button type="button" onClick={() => setAsking(false)} className={cn(BUTTON, 'bg-white/[0.07] text-white hover:bg-white/15')}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={cn(BUTTON, 'bg-white/[0.07] text-white hover:bg-white/15')}>
          Reveal results
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full text-[max(1.5vmin,0.8125rem)] font-medium text-white">
          {error.message}
        </p>
      )}
    </div>
  )
}
