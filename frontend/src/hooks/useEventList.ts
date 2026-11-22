import type { Event } from '@bis/shared'
import { useMemo } from 'react'
import { competitorName } from '../lib/format.ts'
import { useEvents } from './useEvents.ts'
import { useCompetitionEntries, useCompetitorRows } from './useSecretariat.ts'

export interface EventListRow {
  key: string
  event: Event
  backNumber: number | null
  names: string
  teamName: string
}

// Every entry of a competition, event by event: the back number and the dancers' names (not scratched)
export function useEventList(competitionId: string) {
  const events = useEvents(competitionId)
  const entries = useCompetitionEntries(competitionId)
  const people = useCompetitorRows()

  const rows = useMemo<EventListRow[]>(() => {
    const byEvent = new Map((events.data ?? []).map((e) => [e.id, e]))
    const byPerson = new Map((people.data ?? []).map((c) => [c.id, c]))
    const out: EventListRow[] = []
    for (const entry of entries.data ?? []) {
      const event = byEvent.get(entry.eventId)
      const person = byPerson.get(entry.competitorId)
      if (!event || !person || entry.scratched) continue
      out.push({ key: entry.id, event, backNumber: person.backNumber, names: competitorName(person.names), teamName: person.teamName })
    }
    return out.sort((a, b) => a.event.number - b.event.number || (a.backNumber ?? Infinity) - (b.backNumber ?? Infinity))
  }, [events.data, entries.data, people.data])

  return {
    events: [...(events.data ?? [])].sort((a, b) => a.number - b.number),
    rows,
    isLoading: events.isLoading || entries.isLoading || people.isLoading,
    isError: events.isError || entries.isError || people.isError,
    retry: () => void Promise.all([events.refetch(), entries.refetch(), people.refetch()]),
  }
}
