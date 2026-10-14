import { Role } from '@bis/shared'
import { useSearchParams } from 'react-router'
import { useCompetitionRounds, useCurrentRoundId } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { useAuth } from '../../stores/auth.ts'

// The round a scrutineer screen shows: the one in the address, otherwise the round on the floor
export function useRoundChoice() {
  const [params, setParams] = useSearchParams()
  const { competitionId } = useCompetitionChoice(null)
  const rounds = useCompetitionRounds(competitionId ?? '')
  const current = useCurrentRoundId()
  const role = useAuth((s) => s.user?.role)

  const asked = params.get('round')
  const list = rounds.data ?? []
  const roundId = asked && list.some((r) => r.roundId === asked) ? asked : (current.data ?? '')

  return {
    competitionId: competitionId ?? '',
    rounds,
    list,
    roundId,
    row: list.find((r) => r.roundId === roundId),
    setRoundId: (id: string) => setParams({ round: id }, { replace: true }),
    // The chairperson sees the same screens but cannot change anything
    readOnly: role === Role.Chairperson,
    isChairperson: role === Role.Chairperson,
  }
}
