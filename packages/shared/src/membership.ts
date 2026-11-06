// A membership covers the calendar year it was paid in, whenever in the year that was, and ends on December 31.
// It is stored as that year, so it expires on its own: from January 1 the year no longer matches.
const MONTHS_END = 'December 31'

export const membershipEnds = (memberYear: number) => `${memberYear}-12-31`

export const isMember = (memberYear: number | null, currentYear: number) => memberYear !== null && memberYear >= currentYear

export function membershipLabel(memberYear: number | null, currentYear: number): string {
  if (memberYear === null) return 'Not paid'
  return memberYear >= currentYear ? `Until ${MONTHS_END}, ${memberYear}` : `Expired ${MONTHS_END}, ${memberYear}`
}
