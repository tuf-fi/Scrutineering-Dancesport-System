import type { AccountKind } from '@bis/shared'
import { Button, Dialog, toast } from '../../components/ui/index.ts'
import { useRevokeSessions } from '../../hooks/index.ts'

export interface SignOutTarget {
  kind: AccountKind
  id: string
  name: string
}

// Signs a person out of every device they are signed in on, for a lost phone or a shared password
export function SignOutDialog({ target, onClose }: { target: SignOutTarget | null; onClose: () => void }) {
  const revoke = useRevokeSessions()
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={`Sign ${target?.name ?? ''} out everywhere?`}
      description="Every device they are signed in on stops working at once. They can sign in again."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() =>
              target &&
              revoke.mutate(
                { kind: target.kind, id: target.id },
                {
                  onSuccess: () => {
                    toast.success(`${target.name} is signed out everywhere`)
                    onClose()
                  },
                  onError: (e) => {
                    onClose()
                    toast.error(e.message)
                  },
                },
              )
            }
          >
            {revoke.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </>
      }
    />
  )
}
