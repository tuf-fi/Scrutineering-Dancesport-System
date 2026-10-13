import { useQuery } from '@tanstack/react-query'
import * as api from '../api/index.ts'

export const useResultEventIds = (competitionId: string) =>
  useQuery({
    queryKey: ['result-event-ids', competitionId],
    queryFn: () => api.getResultEventIds(competitionId),
    enabled: competitionId !== '',
  })
