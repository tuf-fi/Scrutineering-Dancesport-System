import type { AthleteInput } from '@bis/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

// Runs a write, then refreshes the queries it affects
function useWrite<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>, invalidates: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useSignUpAthlete = () =>
  useMutation({ mutationFn: (v: { name: string; email: string; password: string }) => api.signUpAthlete(v.name, v.email, v.password) })

export const useSignInAthlete = () =>
  useMutation({ mutationFn: (v: { email: string; password: string }) => api.signInAthlete(v.email, v.password) })

// The signed-in athlete's own page
export const useMyAthlete = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['my-athlete', id], queryFn: () => api.getMyAthlete(id), enabled: id !== '' })
}

export const useSaveMyAthlete = () => useWrite((input: AthleteInput) => api.saveMyAthlete(actor(), input), ['my-athlete'])

export const useRequestMembership = () =>
  useWrite((input: { method: string; reference: string }) => api.requestMembership(actor(), input), ['my-athlete'])

// The secretariat's list of athlete accounts
export const useAthletes = () => useQuery({ queryKey: ['athletes'], queryFn: api.getAthletes })

export const useConfirmMembership = () => useWrite((id: string) => api.confirmMembership(actor(), id), ['athletes'])

export const useRejectMembership = () =>
  useWrite((v: { id: string; reason: string }) => api.rejectMembership(actor(), v.id, v.reason), ['athletes'])

export const useResetAthletePassword = () => useWrite((id: string) => api.resetAthletePassword(actor(), id), [])

export const useDeleteAthlete = () => useWrite((id: string) => api.deleteAthlete(actor(), id), ['athletes'])
