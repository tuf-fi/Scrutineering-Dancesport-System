import type { Role } from '@bis/shared'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../stores/auth.ts'
import { roleHome } from './nav.ts'

// Lets a signed-in user through only when their role is listed
export function RequireRole({ roles, signInPath }: { roles: Role[]; signInPath: string }) {
  const user = useAuth((s) => s.user)
  if (!user) return <Navigate to={signInPath} replace />
  if (!roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />
  return <Outlet />
}
