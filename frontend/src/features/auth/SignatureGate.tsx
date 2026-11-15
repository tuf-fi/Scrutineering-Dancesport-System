import type { ReactNode } from 'react'
import { STAFF_SIGN_IN } from '../../app/nav.ts'
import { useSignOut } from '../../app/useSignOut.ts'
import { Button, Dialog, ErrorState } from '../../components/ui/index.ts'
import { useMySignature } from '../../hooks/index.ts'
import { signsResults } from '../../lib/signing.ts'
import { useAuth } from '../../stores/auth.ts'
import { SignatureSection } from './SignatureSection.tsx'

// The scrutineer and the chairperson sign the final results, so a window asks for their signature, and cannot be closed
// until it is saved: on their first sign-in, and for an account made before signatures existed. Everyone else goes straight in.
export function SignatureGate({ children }: { children: ReactNode }) {
  const role = useAuth((s) => s.user?.role)
  const signOut = useSignOut(STAFF_SIGN_IN)
  const signs = signsResults(role)
  const mine = useMySignature(signs)

  if (!signs) return <>{children}</>
  if (mine.isError) return <ErrorState onRetry={() => void mine.refetch()} />
  // Open only once it is known that there is none, so a saved signature never flashes the window
  const missing = mine.data === null

  return (
    <>
      {children}
      <Dialog
        required
        open={missing}
        onClose={() => {}}
        className="max-w-lg"
        title="Add your signature"
        description="It prints on the final results and the certificates you approve or confirm. Add it once; you can change it later on your account page."
        actions={
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        }
      >
        <SignatureSection />
      </Dialog>
    </>
  )
}
