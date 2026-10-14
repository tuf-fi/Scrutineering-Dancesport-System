import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

// Ends the session on the server, forgets what this device fetched, then goes to the given sign-in page
export function useSignOut(to: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useAuth((s) => s.signOut)
  return () => {
    void api.signOut().catch(() => {})
    signOut()
    queryClient.clear()
    navigate(to, { replace: true })
  }
}
