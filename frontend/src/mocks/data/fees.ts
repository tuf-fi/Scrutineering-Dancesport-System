import { sampleFees, type FeeItem } from '@bis/shared'
import { events } from './events.ts'

// Every sample event is priced; each competition has the fees its events need
export const competitionFees: FeeItem[] = [...new Set(events.map((e) => e.competitionId))].flatMap((competitionId) => {
  const { fees, feeIds } = sampleFees(competitionId, events.filter((e) => e.competitionId === competitionId))
  for (const event of events) if (feeIds.has(event.id)) event.feeId = feeIds.get(event.id)
  return fees
})
