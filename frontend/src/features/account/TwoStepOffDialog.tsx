import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useDisableTotp } from '../../hooks/index.ts'

const FORM_ID = 'two-step-off'

function OffForm({ onClose }: { onClose: () => void }) {
  const disable = useDisableTotp()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    disable.mutate(
      { password, code },
      {
        onSuccess: () => {
          toast.success('Two-step sign-in is off')
          onClose()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input
          label="Code from your app, or a recovery code"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error ?? undefined}
          className="font-mono"
        />
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={FORM_ID} variant="danger" disabled={disable.isPending}>
          {disable.isPending ? 'Turning off…' : 'Turn off'}
        </Button>
      </div>
    </>
  )
}

// Turning it off asks for the password and a code, so someone at an unlocked laptop cannot switch it off
export function TwoStepOffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Turn off two-step sign-in?" description="Your password alone will sign you in again.">
      {open && <OffForm onClose={onClose} />}
    </Dialog>
  )
}
