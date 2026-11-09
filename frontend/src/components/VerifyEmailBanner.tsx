import { Button, toast } from './ui/index.ts'
import { useResendVerification } from '../hooks/index.ts'

// Shown on an account page until the address is confirmed: what to do, and a way to get the email again
export function VerifyEmailBanner({ email }: { email?: string }) {
  const resend = useResendVerification()

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-gold-200 py-4">
      <p className="max-w-2xl text-small text-neutral-800">
        <span className="font-semibold">Confirm your email address.</span> We sent a link{email ? ` to ${email}` : ''}. Open it to link your account to a record, enter events and pay.
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={resend.isPending}
        onClick={() => resend.mutate(undefined, { onSuccess: () => toast.success('Email sent. Check your inbox and spam folder.'), onError: (e) => toast.error(e.message) })}
      >
        {resend.isPending ? 'Sending…' : 'Send it again'}
      </Button>
    </div>
  )
}
