import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarkSubmission } from '@bis/shared'
import * as api from '../api/index.ts'

// TODO: phase 3 pushes round changes over the venue socket; until then the phone asks every few seconds
const POLL_MS = 3000

export const useAdjudicatorState = (adjudicatorId: string) =>
  useQuery({
    queryKey: ['adjudicator-state', adjudicatorId],
    queryFn: () => api.getAdjudicatorState(adjudicatorId),
    refetchInterval: POLL_MS,
  })

export function useSubmitMarks(adjudicatorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { roundId: string; submissions: MarkSubmission[] }) =>
      api.submitAdjudicatorMarks(adjudicatorId, v.roundId, v.submissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adjudicator-state', adjudicatorId] }),
  })
}

export const useDemoRounds = () =>
  useQuery({ queryKey: ['demo-rounds'], queryFn: api.getDemoRounds, enabled: import.meta.env.DEV })

export function useStartDemoRound() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roundId: string | null) => api.startDemoRoundOnFloor(roundId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adjudicator-state'] }),
  })
}
