import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'

// How far the venue is behind the cloud; looked at every 15 seconds
const SYNC_CHECK_MS = 15_000
export const useSyncStatus = (enabled = true) =>
  useQuery({ queryKey: ['sync-status'], queryFn: api.getSyncStatus, enabled, refetchInterval: SYNC_CHECK_MS })

export const useCloudCompetitions = (enabled: boolean) =>
  useQuery({ queryKey: ['cloud-competitions'], queryFn: api.getCloudCompetitions, enabled, retry: false })

// Every sync action ends by refreshing the status and the list of competitions on the cloud
function useSyncWrite<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
        queryClient.invalidateQueries({ queryKey: ['cloud-competitions'] }),
      ]),
  })
}

export const usePullCompetition = () => useSyncWrite((competitionId: string) => api.pullCompetition(competitionId))
export const useSyncNow = () => useSyncWrite(() => api.syncNow())
export const useUploadCompetition = () => useSyncWrite((competitionId: string) => api.uploadCompetition(competitionId))
// Online: an admin takes a competition back from a venue that will not return it
export function useUnlockCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (competitionId: string) => api.unlockCompetition(competitionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitions'] }),
  })
}

export const useReleaseCompetition = () => useSyncWrite((competitionId: string) => api.releaseCompetition(competitionId))
