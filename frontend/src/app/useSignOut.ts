import { useNavigate } from 'react-router'
import { useAuth } from '../stores/auth.ts'

// Clears the session, then goes to the given sign-in page
export function useSignOut(to: string) {
  const navigate = useNavigate()
  const signOut = useAuth((s) => s.signOut)
  return () => {
    signOut()
    navigate(to, { replace: true })
  }
}
