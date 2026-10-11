import { useState, type FormEvent } from 'react'
import { Button, Input } from '../../components/ui/index.ts'

interface CredentialsFormProps {
  idLabel: string
  idType?: 'text' | 'email'
  idAutoComplete: string
  // Rejects with an Error whose message is shown to the user
  onSubmit: (id: string, password: string) => Promise<void>
}

export function CredentialsForm({ idLabel, idType = 'text', idAutoComplete, onSubmit }: CredentialsFormProps) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await onSubmit(id, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label={idLabel}
        type={idType}
        autoComplete={idAutoComplete}
        value={id}
        onChange={(e) => setId(e.target.value)}
        required
        autoFocus
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        required
      />
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
