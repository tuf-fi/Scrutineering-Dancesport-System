import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarkSubmission } from '@bis/shared'
import * as api from '../api/index.ts'
import { usingMocks } from '../api/mode.ts'
import { usePoll } from './usePoll.ts'

// The server pushes round changes over the socket; the sample app has no server, so the phone asks every few seconds
const POLL_MS = 3000

export const useAdjudicatorState = (adjudicatorId: string) =>
  useQuery({
    queryKey: ['adjudicator-state', adjudicatorId],
    queryFn: () => api.getAdjudicatorState(adjudicatorId),
    refetchInterval: usePoll(POLL_MS),
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
  useQuery({ queryKey: ['demo-rounds'], queryFn: api.getDemoRounds, enabled: import.meta.env.DEV && usingMocks })

export function useStartDemoRound() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roundId: string | null) => api.startDemoRoundOnFloor(roundId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adjudicator-state'] }),
  })
}
