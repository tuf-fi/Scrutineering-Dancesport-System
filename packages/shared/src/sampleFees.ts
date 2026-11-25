import type { Event, FeeItem } from './types.ts'

// Sample data only: the fees that the seed, the demo competitions, the sample screens and the tests start with. A real
// competition has the fees its admin types in.
const TIERS = {
  soloJuvenile: { name: 'Solo, juvenile', amount: 400, extra: 200 },
  soloOlder: { name: 'Solo, junior and youth', amount: 600, extra: 200 },
  coupleJuvenile: { name: 'Couple, juvenile', amount: 700, extra: 200 },
  coupleOlder: { name: 'Couple, junior and youth', amount: 850, extra: 250 },
  fixed: { name: 'Ranking and inter-collegiate', amount: 1000, extra: null },
}

type PricedEvent = Pick<Event, 'id' | 'ageGroup' | 'kind' | 'isSolo'>

function tierOf(event: PricedEvent): keyof typeof TIERS {
  if (event.kind === 'ranking' || event.kind === 'inter_collegiate') return 'fixed'
  if (event.kind === 'inter_elementary') return 'coupleJuvenile'
  if (event.kind === 'inter_high_school') return 'coupleOlder'
  const juvenile = event.ageGroup.startsWith('juvenile')
  if (event.isSolo) return juvenile ? 'soloJuvenile' : 'soloOlder'
  return juvenile ? 'coupleJuvenile' : 'coupleOlder'
}

// The fees these events need, and which one prices each of them
export function sampleFees(competitionId: string, events: PricedEvent[]): { fees: FeeItem[]; feeIds: Map<string, string> } {
  const fees = new Map<string, FeeItem>()
  const feeIds = new Map<string, string>()
  for (const event of events) {
    const tier = tierOf(event)
    const id = `${competitionId}:fee:${tier}:${event.isSolo ? 'solo' : 'couple'}`
    const { name, amount, extra } = TIERS[tier]
    const wrongType = tier === 'fixed' || (tier.startsWith('couple') && event.isSolo)
    fees.set(id, { id, competitionId, name: wrongType ? `${name} (${event.isSolo ? 'solo' : 'couple'})` : name, amount, extra, late: event.isSolo ? 500 : 800 })
    feeIds.set(event.id, id)
  }
  return { fees: [...fees.values()], feeIds }
}
