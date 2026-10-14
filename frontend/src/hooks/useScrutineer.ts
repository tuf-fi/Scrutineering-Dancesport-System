import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HeatAssignment, TieDecision } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'
import { usePoll } from './usePoll.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

// Marks arrive while the scrutineer watches: the server pushes a change over the socket, and the sample app polls
const POLL_MS = 3000

export const useCurrentRoundId = () => useQuery({ queryKey: ['current-round'], queryFn: api.getCurrentRoundId })

export const useCompetitionRounds = (competitionId: string) =>
  useQuery({
    queryKey: ['competition-rounds', competitionId],
    queryFn: () => api.getCompetitionRounds(competitionId),
    enabled: competitionId !== '',
    refetchInterval: usePoll(POLL_MS),
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
    refetchInterval: usePoll(POLL_MS),
  })

export const useSkatingTable = (roundId: string) =>
  useQuery({
    queryKey: ['skating', roundId],
    queryFn: () => api.getSkatingTable(roundId),
    enabled: roundId !== '',
    refetchInterval: usePoll(POLL_MS),
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

// Creates the rounds each event with entries needs; returns how many events were planned
export function usePlanRounds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (competitionId: string) => api.planRounds(actor(), competitionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-rounds'] }),
  })
}

// Puts a round on the adjudicators' phones
export const useStartRound = () =>
  useWrite((roundId: string) => api.startRound(actor(), roundId), ['competition-rounds', 'round', 'rounds', 'current-round', 'live-submissions'])

// Takes the round off the floor; only possible before any adjudicator has submitted
export const useClearFloor = () =>
  useWrite((competitionId: string) => api.clearFloor(actor(), competitionId), ['competition-rounds', 'round', 'rounds', 'current-round'])

// Whether the database copies (USB drive, Laptop 3) are being written; checked once a minute
const BACKUP_CHECK_MS = 60_000
export const useBackupStatus = (enabled: boolean) =>
  useQuery({ queryKey: ['backup-status'], queryFn: api.getBackupStatus, enabled, refetchInterval: BACKUP_CHECK_MS })
