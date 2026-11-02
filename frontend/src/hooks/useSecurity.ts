import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

export const useTotpStatus = () => useQuery({ queryKey: ['totp-status'], queryFn: () => api.getTotpStatus(actor()) })

function useTotpWrite<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['totp-status'] }), queryClient.invalidateQueries({ queryKey: ['staff-users'] })]),
  })
}

export const useStartTotpSetup = () => useTotpWrite(() => api.startTotpSetup(actor()))
export const useConfirmTotpSetup = () => useTotpWrite((code: string) => api.confirmTotpSetup(actor(), code))
export const useDisableTotp = () => useTotpWrite((v: { password: string; code: string }) => api.disableTotp(actor(), v.password, v.code))
export const useResetTotp = () => useTotpWrite((id: string) => api.resetTotp(actor(), id))

// Staff changing their own password or name
export const useChangeMyStaffPassword = () => useMutation({ mutationFn: (v: { current: string; next: string }) => api.changeMyStaffPassword(actor(), v.current, v.next) })

export const useSaveMyStaffName = () => {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (name: string) => api.saveMyStaffName(actor(), name), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-users'] }) })
}
