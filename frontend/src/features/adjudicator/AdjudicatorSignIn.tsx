import { PIN_LENGTH } from '@bis/shared'
import { Navigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { AuthShell } from '../auth/AuthShell.tsx'
import { DevHint } from '../auth/DevHint.tsx'
import { PinSignIn } from '../auth/PinSignIn.tsx'
import { useAuth } from '../../stores/auth.ts'

// The page a PIN card's QR code opens; the same keypad is on the staff sign-in
export function AdjudicatorSignIn() {
  const user = useAuth((s) => s.user)
  if (user) return <Navigate to={roleHome[user.role]} replace />

  return (
    <AuthShell title="Enter your PIN" description={`The scrutineer gave you a ${PIN_LENGTH}-digit PIN.`} footer={<DevHint kind="pin" />}>
      <PinSignIn />
    </AuthShell>
  )
}
