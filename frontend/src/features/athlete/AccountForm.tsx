import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../../api/http.ts'
import { roleHome, safeNext } from '../../app/nav.ts'
import { PhotoInput } from '../../components/PhotoInput.tsx'
import type { SessionUser, SimilarAccount } from '@bis/shared'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useClaimAthleteRecord, useFindSimilarAccounts, useResendVerification, useSignInAthlete, useSignInMember, useSignUpAthlete, useSignUpMember } from '../../hooks/index.ts'
import { passwordMeetsRules } from '../../lib/passwordRules.ts'
import { useAuth } from '../../stores/auth.ts'
import { DevHint } from '../auth/DevHint.tsx'
import { ACCOUNT_COPY } from './accountCopy.ts'
import { PasswordRules } from './PasswordRules.tsx'

export type AccountMode = 'sign-in' | 'sign-up'
export type AccountKind = 'athlete' | 'coach' | 'team'

// The sign-in and create-account form for an athlete, a coach or a team; used on the sign-in pages and in the navbar's dialog
export function AccountForm({ kind, mode, onMode, onDone }: { kind: AccountKind; mode: AccountMode; onMode: (mode: AccountMode) => void; onDone?: () => void }) {
  const copy = ACCOUNT_COPY[kind]
  const member = kind === 'athlete' ? 'coach' : kind
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const memberIn = useSignInMember(member)
  const memberUp = useSignUpMember(member)
  const athleteIn = useSignInAthlete()
  const athleteUp = useSignUpAthlete()
  const signInMutation = kind === 'athlete' ? athleteIn : memberIn
  const signUpMutation = kind === 'athlete' ? athleteUp : memberUp
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [photo, setPhoto] = useState('')
  const [photoError, setPhotoError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<{ session: SessionUser; email: string } | null>(null)
  const resend = useResendVerification()
  const findSimilar = useFindSimilarAccounts()
  const claim = useClaimAthleteRecord()
  const queryClient = useQueryClient()
  // Records or teams already on file under this name; set while the form asks if it is the same one
  const [similar, setSimilar] = useState<SimilarAccount[] | null>(null)
  const [pick, setPick] = useState('')
  // An athlete who said "that's me" is linked to that record once the account exists
  const linkTo = useRef<string | null>(null)

  async function enter(session: SessionUser) {
    signIn(session)
    // The link request goes in before the account page opens, so it shows there at once
    if (linkTo.current) {
      await claim.mutateAsync(linkTo.current).catch((e: Error) => toast.error(e.message))
      linkTo.current = null
      await queryClient.resetQueries({ queryKey: ['my-athlete'] })
    }
    onDone?.()
    navigate(safeNext(params.get('next')) ?? roleHome[session.role], { replace: true })
  }

  const creating = mode === 'sign-up'
  const pending = signInMutation.isPending || signUpMutation.isPending
  const matches = password.length > 0 && password === confirm
  const ready = !creating || (passwordMeetsRules(password) && matches)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!ready) return
    if (creating && !photo) return setPhotoError('Add a photo.')
    // Ask first when this name is already on file, so one person or team is not added twice
    if (creating && kind !== 'coach' && name.trim()) {
      try {
        const found = await findSimilar.mutateAsync({ kind, name })
        if (found.length > 0) {
          setPick(found[0]!.id)
          return setSimilar(found)
        }
      } catch {
        // The check is a courtesy; sign-up goes on without it
      }
    }
    await create()
  }

  async function create() {
    try {
      const session = creating
        ? await signUpMutation.mutateAsync({ name, email, password, photo })
        : await signInMutation.mutateAsync({ email, password })
      // A new account first sees where the confirmation link went; it is signed in when they continue
      if (creating && session.confirmEmail) return setSentTo({ session, email })
      await enter(session)
    } catch (e) {
      // A photo too big for the server, or one it did not accept, is the photo's problem
      if (creating && e instanceof ApiError && e.status === 413) return setPhotoError('The image exceeded the maximum size.')
      if (creating && e instanceof Error && /photo|picture/i.test(e.message)) return setPhotoError(e.message)
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
    }
  }

  function switchMode() {
    setError(null)
    setPhotoError(undefined)
    setConfirm('')
    onMode(creating ? 'sign-in' : 'sign-up')
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-title font-semibold text-neutral-900">Check your email</h2>
        <p role="status" className="text-body text-neutral-800">
          We sent a confirmation link to <span className="font-semibold">{sentTo.email}</span>. Open it to confirm your address. It works for 24 hours. Check your spam folder too.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => void enter(sentTo.session)}>
            Go to my account
          </Button>
          <Button
            variant="secondary"
            size="lg"
            disabled={resend.isPending}
            onClick={() => resend.mutate(undefined, { onSuccess: () => toast.success('Email sent again.'), onError: (e) => toast.error(e.message) })}
          >
            {resend.isPending ? 'Sending…' : 'Send it again'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Dialog
        open={similar !== null}
        onClose={() => setSimilar(null)}
        title={kind === 'team' ? 'Is this your team?' : 'Is this you?'}
        description={
          kind === 'team'
            ? `A team named ${name.trim()} is already on file. You can continue and create yours.`
            : `${name.trim()} is already on file. If that is you, we link your account to it and the secretariat confirms it. No second record is made.`
        }
        actions={
          kind === 'team' ? (
            <>
              <Button variant="ghost" onClick={() => setSimilar(null)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  setSimilar(null)
                  void create()
                }}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  linkTo.current = null
                  setSimilar(null)
                  void create()
                }}
              >
                No, a different person
              </Button>
              <Button
                onClick={() => {
                  linkTo.current = pick
                  setSimilar(null)
                  void create()
                }}
              >
                Yes, that is me
              </Button>
            </>
          )
        }
      >
        {similar && similar.length > 1 && kind === 'athlete' ? (
          <Select label="Which record" value={pick} onChange={(e) => setPick(e.target.value)}>
            {similar.map((m) => (
              <option key={m.id} value={m.id}>
                {[m.name, m.teamName].filter(Boolean).join(' · ')}
              </option>
            ))}
          </Select>
        ) : (
          <ul aria-label="Already on file" className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
            {similar?.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 py-3">
                <span className="font-semibold text-neutral-900">{m.name}</span>
                {m.teamName && <span className="text-small text-neutral-600">{m.teamName}</span>}
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {creating && <Input label={copy.name} autoComplete={kind === 'team' ? 'organization' : 'name'} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />}
        {creating && <PhotoInput name={name} value={photo} onChange={(p) => { setPhoto(p); setPhotoError(undefined) }} error={photoError} label={kind === 'team' ? 'Team picture' : 'Photo'} />}
        {!creating && kind !== 'team' ? (
          <Input label="Membership ID or email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        ) : (
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!creating} />
        )}
        <Input
          label="Password"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={creating ? undefined : (error ?? undefined)}
          required
        />
        {creating && (
          <>
            <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} required />
            <PasswordRules password={password} matches={matches} />
          </>
        )}
        {!creating && (
          <Link to={`/forgot-password?as=${kind}`} onClick={onDone} className="-mt-2 w-fit text-small font-semibold text-neutral-900 underline underline-offset-4">
            Forgot password?
          </Link>
        )}
        <Button type="submit" size="lg" disabled={pending || !ready} className="mt-1 w-full">
          {pending ? (creating ? 'Creating…' : 'Signing in…') : creating ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <div className="flex flex-col gap-3 text-small">
        <p className="text-neutral-600">
          {creating ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" onClick={switchMode} className="font-semibold text-neutral-900 underline underline-offset-4">
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        {!creating && <DevHint kind={kind} />}
      </div>
    </div>
  )
}
