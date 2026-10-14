import { useState } from 'react'
import { usingMocks } from '../../api/mode.ts'
import { Button, Select } from '../../components/ui/index.ts'
import { useDemoRounds, useStartDemoRound } from '../../hooks/index.ts'

// Sample app only. With the real server the scrutineer starts each round from their Rounds screen.
export function DemoControls() {
  const rounds = useDemoRounds()
  const start = useStartDemoRound()
  const [roundId, setRoundId] = useState('')

  if (!import.meta.env.DEV || !usingMocks || !rounds.data?.length) return null
  const chosen = roundId || rounds.data[0].roundId

  return (
    <details className="group mt-auto border-t border-neutral-200 pt-4">
      <summary className="cursor-pointer list-none text-xs text-neutral-500 hover:text-neutral-900">
        Demo controls
      </summary>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select label="Round" hideLabel value={chosen} onChange={(e) => setRoundId(e.target.value)}>
            {rounds.data.map((r) => (
              <option key={r.roundId} value={r.roundId}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" disabled={start.isPending} onClick={() => start.mutate(chosen)}>
          Start round
        </Button>
        <Button variant="ghost" disabled={start.isPending} onClick={() => start.mutate(null)}>
          Clear floor
        </Button>
      </div>
    </details>
  )
}
