import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

export const useOfflineDays = () => useQuery({ queryKey: ['offline-days'], queryFn: api.getOfflineDays })

function useOfflineWrite<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offline-days'] }) })
}

export const useStartOfflineDay = () => useOfflineWrite((competitionId: string) => api.startOfflineDay(actor(), competitionId))
export const useCancelOfflineDay = () => useOfflineWrite((competitionId: string) => api.cancelOfflineDay(actor(), competitionId))

// A trial run only shows what would change; the real one keeps it and lets go of the competition
export function useLoadDayFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { file: Blob; dryRun: boolean }) => api.loadDayFile(v.file, v.dryRun),
    onSuccess: (_counts, v) => (v.dryRun ? undefined : queryClient.invalidateQueries()),
  })
}
