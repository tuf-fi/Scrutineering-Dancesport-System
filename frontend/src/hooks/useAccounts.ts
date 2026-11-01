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

