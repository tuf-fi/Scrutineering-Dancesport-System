import type { TeamMembershipRow } from '@bis/shared'
import { useRef, useState, type FormEvent } from 'react'
import { Badge, Button, EmptyState, ErrorState, Input, Select, SkeletonList, toast } from '../../components/ui/index.ts'
import { useRequestTeamMembership, useTeamMembership } from '../../hooks/index.ts'
import { formatPeso } from '../../lib/format.ts'
import { screenshotImage } from '../../lib/image.ts'
import { AccountSection } from './AccountSection.tsx'

const STATUS: Record<TeamMembershipRow['status'], { label: string; tone: 'success' | 'gold' | 'danger' | 'neutral' }> = {
  paid: { label: 'Paid', tone: 'success' },
  waiting: { label: 'Waiting for the secretariat', tone: 'gold' },
  rejected: { label: 'Not confirmed', tone: 'danger' },
  unpaid: { label: 'Not paid', tone: 'neutral' },
}

// A team pays the membership fee for the athletes it ticks, in one payment
export function TeamMembership() {
  const page = useTeamMembership()
  const send = useRequestTeamMembership()
  const [chosen, setChosen] = useState<string[]>([])
  const [method, setMethod] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>()
  const picker = useRef<HTMLInputElement>(null)

  if (page.isError) return <ErrorState onRetry={() => void page.refetch()} />
  if (!page.data) return <SkeletonList rows={4} />

  const { year, fee, methods, athletes } = page.data
  const payable = athletes.filter((a) => a.status === 'unpaid' || a.status === 'rejected')
  const picked = payable.filter((a) => chosen.includes(a.id))
  const how = method || methods[0]?.name || ''

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
    if (picked.length === 0) return setError('Choose the athletes you are paying for.')
    if (!how.trim()) return setError('Say how you paid.')
    if (!receipt) return setError('Send a screenshot of your payment.')
    setError(undefined)
    send.mutate(
      { athleteIds: picked.map((a) => a.id), method: how, receipt },
      {
        onSuccess: () => {
          toast.success('Payment sent to the secretariat')
          setChosen([])
          setReceipt(null)
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <AccountSection title={`${year} membership`} note={`Paid once a year for each athlete. It ends on December 31, ${year}, whenever you pay. The secretariat confirms it when the money arrives.`}>
      {athletes.length === 0 ? (
        <EmptyState title="No athletes on your team yet" description="Athletes appear here when their team is set to yours." />
      ) : (
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          <fieldset className="flex flex-col gap-4">
            <legend className="font-mono text-xs uppercase text-neutral-500">Athletes · {formatPeso(fee)} each</legend>
            <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
              {athletes.map((a) => {
                const open = a.status === 'unpaid' || a.status === 'rejected'
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3.5">
                    <label className="flex min-w-0 items-center gap-3 text-body text-neutral-900">
                      <input
                        type="checkbox"
                        disabled={!open}
                        checked={chosen.includes(a.id)}
                        onChange={(e) => setChosen((list) => (e.target.checked ? [...list, a.id] : list.filter((x) => x !== a.id)))}
                        className="size-5 shrink-0 accent-neutral-900"
                      />
                      <span className="font-medium">{a.name}</span>
                    </label>
                    <span className="flex items-center gap-3">
                      {a.status === 'paid' && a.membershipId && <span className="font-mono text-xs uppercase text-neutral-500">ID {a.membershipId}</span>}
                      <Badge pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                    </span>
                    {a.status === 'rejected' && a.reason && <span className="basis-full pl-8 text-small text-danger">Not confirmed: {a.reason}</span>}
                  </li>
                )
              })}
            </ul>
            {methods.length > 0 && (
              <>
                <h3 className="pt-4 font-mono text-xs uppercase text-neutral-500">Pay to</h3>
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
              </>
            )}
          </fieldset>

          <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border border-neutral-200 p-6">
            <h3 className="font-mono text-xs uppercase text-neutral-500">Confirm your payment</h3>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase text-neutral-500">Total</span>
              <p className="font-mono text-display font-semibold leading-none tabular-nums text-neutral-900">{formatPeso(fee * picked.length)}</p>
              <p className="text-small text-neutral-600">
                {picked.length} athlete{picked.length === 1 ? '' : 's'} chosen
              </p>
            </div>
            {methods.length > 0 ? (
              <Select label="Paid with" required value={how} onChange={(e) => setMethod(e.target.value)}>
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
            <Button type="submit" disabled={send.isPending || payable.length === 0} className="w-full">
              {send.isPending ? 'Sending…' : 'Send payment'}
            </Button>
          </form>
        </div>
      )}
    </AccountSection>
  )
}
