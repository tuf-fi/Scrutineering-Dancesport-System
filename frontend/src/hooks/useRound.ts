import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdjudicatorSubmission } from '@bis/shared'
import * as api from '../api/index.ts'

export const useRounds = (eventId: string) =>
  useQuery({ queryKey: ['rounds', eventId], queryFn: () => api.getRounds(eventId) })

export const useRound = (id: string) =>
  useQuery({ queryKey: ['round', id], queryFn: () => api.getRound(id) })

export const useHeats = (roundId: string) =>
  useQuery({ queryKey: ['heats', roundId], queryFn: () => api.getHeats(roundId) })

export const useMarks = (roundId: string) =>
  useQuery({ queryKey: ['marks', roundId], queryFn: () => api.getMarks(roundId) })

// Live board data: each adjudicator's status, updated as submissions arrive
export function useLiveSubmissions(roundId: string): AdjudicatorSubmission[] {
  const queryClient = useQueryClient()
  const [submissions, setSubmissions] = useState<AdjudicatorSubmission[]>(() =>
    api.getSubmissionSnapshot(roundId),
  )

  useEffect(() => {
    let first = true
    return api.subscribeSubmissions(roundId, (next) => {
      setSubmissions(next)
      // The first call is the current state, not a change
      if (first) return void (first = false)
      void queryClient.invalidateQueries({ queryKey: ['marks', roundId] })
      void queryClient.invalidateQueries({ queryKey: ['round', roundId] })
      void queryClient.invalidateQueries({ queryKey: ['rounds'] })
    })
  }, [roundId, queryClient])

  return submissions
}
