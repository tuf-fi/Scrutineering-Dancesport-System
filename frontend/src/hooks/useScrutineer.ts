import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HeatAssignment, TieDecision } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

// Marks arrive while the scrutineer watches, so these refresh on their own
// TODO: phase 3 pushes them over the venue socket instead of polling
const POLL_MS = 3000

export const useCurrentRoundId = () => useQuery({ queryKey: ['current-round'], queryFn: api.getCurrentRoundId })

export const useCompetitionRounds = (competitionId: string) =>
  useQuery({
    queryKey: ['competition-rounds', competitionId],
    queryFn: () => api.getCompetitionRounds(competitionId),
    enabled: competitionId !== '',
    refetchInterval: POLL_MS,
  })

export const useHeatAssignments = (roundId: string) =>
  useQuery({
    queryKey: ['heat-assignments', roundId],
    queryFn: () => api.getHeatAssignments(roundId),
    enabled: roundId !== '',
  })

export const useRecallTable = (roundId: string, enabled = true) =>
  useQuery({
    queryKey: ['recall', roundId],
    queryFn: () => api.getRecallTable(roundId),
    enabled: enabled && roundId !== '',
    refetchInterval: POLL_MS,
  })

export const useSkatingTable = (roundId: string) =>
  useQuery({
    queryKey: ['skating', roundId],
    queryFn: () => api.getSkatingTable(roundId),
    enabled: roundId !== '',
    refetchInterval: POLL_MS,
  })

function useWrite<TVars>(mutationFn: (vars: TVars) => Promise<void>, invalidates: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useSaveHeats = () =>
  useWrite(
    (v: { roundId: string; assignments: HeatAssignment[] }) => api.saveHeats(actor(), v.roundId, v.assignments),
    ['heat-assignments', 'heats', 'competition-rounds'],
  )

export const useProposeTie = () =>
  useWrite((v: { roundId: string; choice: TieDecision['choice'] }) => api.proposeTieDecision(actor(), v.roundId, v.choice), ['recall'])

export const useConfirmTie = () => useWrite((roundId: string) => api.confirmTieDecision(actor(), roundId), ['recall'])

export const useApproveRound = () =>
  useWrite((roundId: string) => api.approveRound(actor(), roundId), ['competition-rounds', 'round', 'rounds', 'skating', 'recall'])

export const usePublishRound = () =>
  useWrite((roundId: string) => api.publishRound(actor(), roundId), ['competition-rounds', 'round', 'rounds', 'skating', 'recall'])
