import { Role, RoundStatus } from '@bis/shared'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useCompetitionRounds, useCurrentRoundId } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { useAuth } from '../../stores/auth.ts'

// The round a scrutineer screen shows: the one in the address, otherwise the round on the floor, otherwise the round that is
// open or next in this competition, so a screen is never left waiting for a round that is not there
// pin: keep the shown round in the address, so it stays put when the floor clears (e.g. after approving)
export function useRoundChoice(pin = false) {
  const [params, setParams] = useSearchParams()
  const { competitionId } = useCompetitionChoice(null)
  const rounds = useCompetitionRounds(competitionId ?? '')
  const current = useCurrentRoundId()
  const role = useAuth((s) => s.user?.role)

  const asked = params.get('round')
  const list = rounds.data ?? []
  const inList = (id: string | null | undefined) => (id && list.some((r) => r.roundId === id) ? id : null)
  const ordered = [...list].sort((a, b) => a.eventNumber - b.eventNumber)
  const open = ordered.find((r) => r.status === RoundStatus.Marking || r.status === RoundStatus.Review)
  const next = ordered.find((r) => r.status === RoundStatus.Pending)
  const picked = inList(asked) ?? inList(current.data)
  const roundId = picked ?? open?.roundId ?? next?.roundId ?? ordered.at(-1)?.roundId ?? ''

  useEffect(() => {
    if (pin && !asked && roundId) setParams({ round: roundId }, { replace: true })
  }, [pin, asked, roundId, setParams])

  return {
    competitionId: competitionId ?? '',
    rounds,
    list,
    // The competition has no rounds at all: nothing to choose, so screens say so instead of waiting
    noRounds: rounds.isSuccess && list.length === 0,
    // The round was found because nothing is chosen and nothing is on the floor, not because anyone asked for it
    fallback: !picked && roundId !== '',
    roundId,
    floorId: current.data ?? '',
    row: list.find((r) => r.roundId === roundId),
    setRoundId: (id: string) => setParams({ round: id }, { replace: true }),
    // The chairperson can do everything the scrutineer can
    readOnly: false,
    isChairperson: role === Role.Chairperson,
  }
}
