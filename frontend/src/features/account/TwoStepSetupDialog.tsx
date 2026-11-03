import { useEffect, useRef, useState, type FormEvent } from 'react'
import { QrCode } from '../../components/QrCode.tsx'
import { Button, Dialog, Input, Skeleton, toast } from '../../components/ui/index.ts'
import { useConfirmTotpSetup, useStartTotpSetup } from '../../hooks/index.ts'

const FORM_ID = 'two-step-setup'

// Step 1: add the account to the app, from the QR code or by typing the secret, and type a code to prove it works.
// Step 2: the recovery codes, shown once.
function Setup({ onClose }: { onClose: () => void }) {
  const start = useStartTotpSetup()
  const confirm = useConfirmTotpSetup()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const asked = useRef(false)

  // The secret is made when the dialog opens, once
  const { mutate: startSetup } = start
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    startSetup(undefined, { onError: (e) => setError(e.message) })
  }, [startSetup])

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    confirm.mutate(code, {
      onSuccess: (done) => setRecovery(done.recoveryCodes),
      onError: (e) => setError(e.message),
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText((recovery ?? []).join('\n'))
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Select the codes and copy them.')
    }
  }

  if (recovery) {
    return (
      <>
        <p className="mb-3 text-small text-neutral-700">
          Two-step sign-in is on. Keep these recovery codes somewhere safe, apart from your phone. Each works once if you lose
          the app. They are not shown again.
        </p>
        <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-md bg-neutral-100 p-4 font-mono text-body select-all">
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={copy}>
            Copy
          </Button>
          <Button onClick={onClose}>I have saved them</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <ol className="flex list-decimal flex-col gap-4 pl-5 text-small text-neutral-700">
        <li>
          Open your authenticator app and add an account. Scan this code, or choose to type a key and enter the secret under it.
          {start.data ? (
            <div className="mt-3 flex flex-col items-start gap-3">
              <QrCode value={start.data.uri} label="Code to add the account to your app" size={160} />
              <p className="font-mono text-body tracking-wider text-neutral-900 select-all">{start.data.secret}</p>
            </div>
          ) : (
            <Skeleton className="mt-3 size-40" />
          )}
        </li>
        <li>Type the 6-digit code the app now shows.</li>
      </ol>
      <form id={FORM_ID} onSubmit={submit} noValidate className="mt-4">
        <Input
          label="Code" required
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error ?? undefined}
          className="font-mono tabular-nums"
        />
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={FORM_ID} disabled={confirm.isPending || !start.data}>
          {confirm.isPending ? 'Checking…' : 'Turn on'}
        </Button>
      </div>
    </>
  )
}

export function TwoStepSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Turn on two-step sign-in" className="max-w-lg">
      {open && <Setup onClose={onClose} />}
    </Dialog>
  )
}
