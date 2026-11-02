import { useChangeMyPassword } from '../../hooks/index.ts'
import { PasswordForm } from '../auth/PasswordForm.tsx'
import { AccountSection } from './AccountSection.tsx'

export function ChangePassword() {
  const change = useChangeMyPassword()
  return (
    <AccountSection title="Password" note="Enter your current password, then choose a new one.">
      <PasswordForm change={change} />
    </AccountSection>
  )
}
