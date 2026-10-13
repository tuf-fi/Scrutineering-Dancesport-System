import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgeGroup, ClubSignUp } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const clubId = () => useAuth.getState().user?.id ?? ''
const useClubId = () => useAuth((s) => s.user?.id ?? '')

export const useSignUpClub = () => useMutation({ mutationFn: (input: ClubSignUp) => api.signUpNewClub(input) })

export function useClubDancers() {
  const id = useClubId()
  return useQuery({ queryKey: ['club-dancers', id], queryFn: () => api.getClubDancers(id), enabled: id !== '' })
}

export function useEntryOptions(dancerId: string) {
  const id = useClubId()
  return useQuery({
    queryKey: ['entry-options', id, dancerId],
    queryFn: () => api.getEntryOptions(id, dancerId),
    enabled: id !== '' && dancerId !== '',
  })
}

export function useClubPayments() {
  const id = useClubId()
  return useQuery({ queryKey: ['club-payments', id], queryFn: () => api.getClubPayments(id), enabled: id !== '' })
}

export const usePaymentMethods = () => useQuery({ queryKey: ['payment-methods'], queryFn: api.getPaymentMethods })

// Runs a write, then refreshes what it touches, including the staff screens that show the same data
function useWrite<TVars>(mutationFn: (vars: TVars) => Promise<unknown>, invalidates: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useSaveDancer = () =>
  useWrite(
    (v: { names: string[]; ageGroup: AgeGroup; id?: string }) =>
      api.saveClubDancer(clubId(), { names: v.names, ageGroup: v.ageGroup }, v.id),
    ['club-dancers', 'entry-options', 'competitor-rows'],
  )

export const useDeleteDancer = () =>
  useWrite((id: string) => api.deleteClubDancer(clubId(), id), ['club-dancers', 'competitor-rows'])

export const useRegisterEntries = () =>
  useWrite(
    (v: { dancerId: string; eventIds: string[] }) => api.registerClubEntries(clubId(), v.dancerId, v.eventIds),
    ['club-dancers', 'entry-options', 'club-payments', 'payments', 'competition-entries', 'competitor-rows'],
  )

export const useSubmitPayment = () =>
  useWrite(
    (v: { amountPaid: number; referenceNumber: string; receiptUrl: string }) => api.submitClubPayment(clubId(), v),
    ['club-payments', 'payments'],
  )
