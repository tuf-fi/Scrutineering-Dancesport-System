import type { Round } from '@bis/shared'
import { useSearchParams } from 'react-router'
import { useAdjudicators, useCompetition, useEvent, usePanel, useRounds } from '../../hooks/index.ts'

// Everything a printed sheet shows about one event, plus the round picked in the address (?round=)
export function usePrintContext(eventId: string) {
  const [params] = useSearchParams()
  const event = useEvent(eventId)
  const competition = useCompetition(event.data?.competitionId ?? '')
  const rounds = useRounds(eventId)
  const panel = usePanel(eventId)
  const adjudicators = useAdjudicators()

  const list: Round[] = rounds.data ?? []
  const asked = params.get('round')
  // Without a choice: the latest round that has started, else the first
  const started = list.filter((r) => r.status !== 'pending')
  const round = list.find((r) => r.id === asked) ?? started[started.length - 1] ?? list[0]
  const next = round ? list[list.indexOf(round) + 1] : undefined

  const letters = (panel.data?.adjudicatorIds ?? []).flatMap((id) => {
    const a = adjudicators.data?.find((x) => x.id === id)
    return a ? [{ id: a.id, letter: a.letter, name: a.name }] : []
  })

  return {
    event: event.data,
    competition: competition.data,
    rounds: list,
    round,
    next,
    adjudicators: letters,
    isError: event.isError || rounds.isError || panel.isError,
    isLoading: !event.data || !competition.data || !rounds.data || !panel.data || !adjudicators.data,
    retry: () => void Promise.all([event.refetch(), rounds.refetch(), panel.refetch()]),
  }
}
