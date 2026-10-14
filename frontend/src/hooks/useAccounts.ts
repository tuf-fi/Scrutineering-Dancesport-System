import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaymentSettings } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

export const usePaymentSettings = () => useQuery({ queryKey: ['payment-settings'], queryFn: api.getPaymentSettings })

export function useSavePaymentSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentSettings) => api.savePaymentSettings(actor(), input),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['payment-settings'] }), queryClient.invalidateQueries({ queryKey: ['payment-methods'] })]),
  })
}

export const useChangeClubPassword = () =>
  useMutation({ mutationFn: (v: { current: string; next: string }) => api.changeClubPassword(v.current, v.next) })

export const useResetClubPassword = () => useMutation({ mutationFn: (id: string) => api.resetClubPassword(actor(), id) })

export function useEraseClubAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.eraseClubAccount(actor(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clubs'] }),
  })
}

export const useMessengerLink = () => useQuery({ queryKey: ['messenger-link'], queryFn: api.getMessengerLink })

export function useUnlinkMessenger() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: () => api.unlinkMessenger(), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messenger-link'] }) })
}

export const useClearOldReceipts = () => useMutation({ mutationFn: () => api.clearOldReceipts(actor()) })
