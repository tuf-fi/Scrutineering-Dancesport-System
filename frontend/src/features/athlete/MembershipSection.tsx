import type { AthletePage as AthleteData } from '@bis/shared'
import { useRef, useState, type FormEvent } from 'react'
import { Badge, Button, Input, Select, toast } from '../../components/ui/index.ts'
import { useRequestMembership } from '../../hooks/index.ts'
import { formatPeso } from '../../lib/format.ts'
import { screenshotImage } from '../../lib/image.ts'
import { AccountSection } from './AccountSection.tsx'

export function MembershipSection({ page }: { page: AthleteData }) {
  const { profile, year, fee, methods } = page
  const send = useRequestMembership()
  const [method, setMethod] = useState(methods[0]?.name ?? '')
  const [receipt, setReceipt] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | undefined>()
  const request = profile.request
  const paid = profile.memberYear === year
  const waiting = request !== null && !request.rejectedReason

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      setReceipt(await screenshotImage(file))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!method.trim()) return setError('Say how you paid.')
    if (!receipt) return setError('Send a screenshot of your payment.')
    setError(undefined)
    send.mutate(
      { method, receipt },
      {
        onSuccess: () => {
          toast.success('Payment sent to the secretariat')
          setReceipt(null)
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <AccountSection title={`${year} membership`} note={`Paid once a year. It ends on December 31, ${year}, whenever you pay. The secretariat confirms it when the money arrives.`}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-neutral-200 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase text-neutral-500">Fee</span>
          <p className="font-mono text-display font-semibold leading-none tabular-nums text-neutral-900">{formatPeso(fee)}</p>
        </div>
        <div className="flex items-center gap-4">
          {paid && profile.membershipId && <span className="font-mono text-xs uppercase text-neutral-500">ID {profile.membershipId}</span>}
          {paid && <span className="font-mono text-xs uppercase text-neutral-500">Valid until December 31, {year}</span>}
          {paid ? (
            <Badge pill tone="success">Paid</Badge>
          ) : waiting ? (
            <Badge pill tone="gold">Waiting for the secretariat</Badge>
          ) : request ? (
            <Badge pill tone="danger">Not confirmed</Badge>
          ) : (
            <Badge pill>Not paid</Badge>
          )}
        </div>
      </div>

      {paid ? (
        <p className="text-body text-neutral-700">Your membership is paid and lasts until December 31, {year}.</p>
      ) : waiting ? (
        <p className="text-body text-neutral-700">
          You sent a screenshot of your {request.method} payment{request.reference && <>, reference <span className="font-mono">{request.reference}</span></>}. The secretariat will confirm it once the money arrives.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {request?.rejectedReason && (
            <p role="alert" className="text-body text-danger">
              The secretariat could not confirm your last payment: {request.rejectedReason}
            </p>
          )}
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
            <div className="flex flex-col gap-4">
              <h3 className="font-mono text-xs uppercase text-neutral-500">Pay to</h3>
              {methods.length > 0 && (
                <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
                  {methods.map((m) => (
                    <li key={m.name} className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1 py-4">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold text-neutral-900">{m.name}</span>
                        <span className="text-small text-neutral-600">{m.accountName}</span>
                      </div>
                      <span className="font-mono text-body tabular-nums text-neutral-900">{m.number}</span>
                      {m.note && <span className="basis-full text-small text-neutral-500">{m.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border border-neutral-200 p-6">
              <h3 className="font-mono text-xs uppercase text-neutral-500">Confirm your payment</h3>
              {methods.length > 0 ? (
                <Select label="Paid with" required value={method} onChange={(e) => setMethod(e.target.value)}>
                  {methods.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input label="Paid with" required value={method} onChange={(e) => setMethod(e.target.value)} />
              )}
              <div className="flex flex-col gap-2">
                <span className="text-small font-medium text-neutral-600">Screenshot of your payment</span>
                <div className="flex items-center gap-4">
                  {receipt && <img src={receipt} alt="Your payment screenshot" className="h-20 w-14 rounded-md border border-neutral-200 object-cover object-top" />}
                  <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
                    {receipt ? 'Choose another' : 'Choose a screenshot'}
                  </Button>
                </div>
                <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Payment screenshot" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
                {error && (
                  <p role="alert" className="text-small text-danger">
                    {error}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={send.isPending} className="w-full">
                {send.isPending ? 'Sending…' : 'Send payment'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </AccountSection>
  )
}
