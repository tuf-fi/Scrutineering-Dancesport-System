import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import { useTotpStatus } from '../../hooks/index.ts'
import { TwoStepOffDialog } from './TwoStepOffDialog.tsx'
import { TwoStepSetupDialog } from './TwoStepSetupDialog.tsx'

// A staff member's own sign-in security: two-step sign-in with an authenticator app
export function SecurityPage() {
  const status = useTotpStatus()
  const [setting, setSetting] = useState(false)
  const [turningOff, setTurningOff] = useState(false)

  if (status.isError) return <ErrorState onRetry={() => void status.refetch()} />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Security" description="Protect your account with a code from an app on your phone." />

      <section aria-label="Two-step sign-in" className="flex max-w-2xl flex-col gap-4 border-t border-neutral-200 pt-6">
        <h2 className="text-title font-semibold text-neutral-900">Two-step sign-in</h2>
        {!status.data ? (
          <Skeleton className="h-16 w-full" />
        ) : status.data.enabled ? (
          <>
            <p className="flex items-center gap-2 text-body text-neutral-900">
              <ShieldCheck aria-hidden className="size-5 text-success" strokeWidth={1.75} />
              <span>
                On. After your password you enter a code from your app.{' '}
                <span className="text-neutral-600">
                  {status.data.recoveryLeft === 1 ? '1 recovery code left.' : `${status.data.recoveryLeft} recovery codes left.`}
                </span>
              </span>
            </p>
            <div>
              <Button variant="secondary" onClick={() => setTurningOff(true)}>
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="max-w-prose text-body text-neutral-700">
              Off. A password alone signs you in. Turn this on and a stolen password is not enough: you also need your phone. Use
              an authenticator app such as Google Authenticator, Microsoft Authenticator or Aegis.
            </p>
            <div>
              <Button onClick={() => setSetting(true)}>Turn on</Button>
            </div>
          </>
        )}
      </section>

      <TwoStepSetupDialog open={setting} onClose={() => setSetting(false)} />
      <TwoStepOffDialog open={turningOff} onClose={() => setTurningOff(false)} />
    </div>
  )
}
