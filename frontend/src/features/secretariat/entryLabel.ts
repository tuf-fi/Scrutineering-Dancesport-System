import type { CompetitorRow } from '@bis/shared'

// Who an entry is for, besides the athlete: alone, or with their partner
export const entryLabel = (entry: CompetitorRow, athlete: string, plain: (name: string) => string) => {
  const partner = entry.names.find((n) => plain(n) !== plain(athlete))
  return partner ? `With ${partner}` : 'Solo'
}
