import { useState } from 'react'
import { Button, Dialog, toast } from '../../components/ui/index.ts'
import { useSignOutEverywhere } from '../../hooks/index.ts'
import { useSignOut } from '../../app/useSignOut.ts'
import { useAuth } from '../../stores/auth.ts'
import { AccountSection } from './AccountSection.tsx'
import { ChangePassword } from './ChangePassword.tsx'

// Sign out on every device, then the password form
function SignOutEverywhere() {
  const end = useSignOutEverywhere()
  const role = useAuth((s) => s.user?.role)
  const leave = useSignOut(role === 'coach' ? '/coach/sign-in' : role === 'team' ? '/team/sign-in' : '/athlete/sign-in')
  const [open, setOpen] = useState(false)

  return (
    <AccountSection title="Sessions" note="Signed in on a phone or a laptop you no longer use? End every session, including this one.">
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Sign out everywhere
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sign out everywhere?"
        description="You will be signed out on every device, including this one, and have to sign in again."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={end.isPending}
              onClick={() =>
                end.mutate(undefined, {
                  onSuccess: () => {
                    setOpen(false)
                    leave()
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              {end.isPending ? 'Signing out…' : 'Sign out everywhere'}
            </Button>
          </>
        }
      />
    </AccountSection>
  )
}

export function SecurityPage() {
  return (
    <div className="flex flex-col gap-12">
      <SignOutEverywhere />
      <ChangePassword />
    </div>
  )
}
