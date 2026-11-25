import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeeItemInput, PaymentSettings } from '@bis/shared'
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

export const useCompetitionFees = (competitionId: string | undefined) =>
  useQuery({ queryKey: ['competition-fees', competitionId], queryFn: () => api.getCompetitionFees(competitionId!), enabled: Boolean(competitionId) })

// A fee changes which events are priced, and so what an entry costs
function useFeeWrite<V, R>(write: (input: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSuccess: () => Promise.all(['competition-fees', 'events', 'event', 'registration-quote'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useSaveFee = () =>
  useFeeWrite((v: { competitionId: string; input: FeeItemInput; id?: string }) => api.saveCompetitionFee(actor(), v.competitionId, v.input, v.id))

export const useDeleteFee = () => useFeeWrite((id: string) => api.deleteCompetitionFee(actor(), id))
