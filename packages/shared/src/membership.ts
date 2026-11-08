// A membership covers the calendar year it was paid in, whenever in the year that was, and ends on December 31.
// It is stored as that year, so it expires on its own: from January 1 the year no longer matches.
const MONTHS_END = 'December 31'

export const membershipEnds = (memberYear: number) => `${memberYear}-12-31`

export const isMember = (memberYear: number | null, currentYear: number) => memberYear !== null && memberYear >= currentYear

export function membershipLabel(memberYear: number | null, currentYear: number, memberMonth?: number | null): string {
  if (memberYear === null) return 'Not paid'
  const base = memberYear >= currentYear ? `Until ${MONTHS_END}, ${memberYear}` : `Expired ${MONTHS_END}, ${memberYear}`
  return memberMonth ? `${base} (paid ${MONTH_NAMES[memberMonth - 1]})` : base
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const SUMMIT_QUARTERS = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter']

// "January 2026", or just the year for a payment recorded before months were kept
export const memberPaidLabel = (month: number | null | undefined, year: number): string => (month ? `${MONTH_NAMES[month - 1]} ${year}` : String(year))

// "4th Quarter 2026" or "Bicol Open 2026"
export const summitPaidLabel = (period: string | null | undefined, year: number): string => (period ? `${period} ${year}` : String(year))

// Paid for this year, paid for an earlier year (expired), or never paid
export const membershipState = (memberYear: number | null, currentYear: number): 'paid' | 'expired' | 'none' =>
  memberYear === null ? 'none' : memberYear >= currentYear ? 'paid' : 'expired'
