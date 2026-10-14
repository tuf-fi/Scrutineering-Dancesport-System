import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { usingMocks } from '../api/mode.ts'

export const useSignInStaff = () =>
  useMutation({
    mutationFn: (v: { username: string; password: string }) => api.signInStaff(v.username, v.password),
  })

export const useSignInClub = () =>
  useMutation({
    mutationFn: (v: { email: string; password: string }) => api.signInClub(v.email, v.password),
  })

export const useSignInAdjudicator = () =>
  useMutation({ mutationFn: (pin: string) => api.signInAdjudicator(pin) })

// Sample credentials for the dev hint; only the sample app has them, and never in a production build
export const useSampleCredentials = () =>
  useQuery({
    queryKey: ['sample-credentials'],
    queryFn: api.getSampleCredentials,
    enabled: import.meta.env.DEV && usingMocks,
  })
