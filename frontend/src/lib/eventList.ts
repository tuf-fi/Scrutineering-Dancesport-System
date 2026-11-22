import type { EventListRow } from '../hooks/useEventList.ts'

export function filterEventList(rows: EventListRow[], eventId: string, query: string) {
  const needle = query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (eventId === 'all' || r.event.id === eventId) &&
      (!needle || `${r.backNumber ?? ''} ${r.names} ${r.teamName}`.toLowerCase().includes(needle)),
  )
}
