import type { AthletePage as AthleteData } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Badge, Button, ErrorState, Input, PageHeader, Select, Skeleton, toast } from '../../components/ui/index.ts'
import { useClubs, useCoaches, useMyAthlete, useRequestMembership, useSaveMyAthlete } from '../../hooks/index.ts'
import { formatPeso } from '../../lib/format.ts'

function Membership({ page }: { page: AthleteData }) {
  const { profile, year, fee, methods } = page
  const send = useRequestMembership()
  const [method, setMethod] = useState(methods[0]?.name ?? '')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | undefined>()
  const request = profile.request
  const paid = profile.memberYear === year
  const waiting = request !== null && !request.rejectedReason

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!method.trim()) return setError('Say how you paid.')
    if (!reference.trim()) return setError('Enter the reference number of your payment.')
    setError(undefined)
    send.mutate(
      { method, reference },
      {
        onSuccess: () => {
          toast.success('Payment sent to the secretariat')
          setReference('')
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="membership">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="membership" className="text-title font-semibold text-neutral-900">
          {year} membership
        </h2>
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

      {paid ? (
        <p className="text-body text-neutral-700">Your membership is paid and lasts until December {year}.</p>
      ) : waiting ? (
        <p className="text-body text-neutral-700">
          You sent {request.method}, reference <span className="font-mono">{request.reference}</span>. The secretariat will confirm it once the money arrives.
        </p>
      ) : (
        <>
          {request?.rejectedReason && (
            <p role="alert" className="text-body text-danger">
              The secretariat could not confirm your last payment: {request.rejectedReason}
            </p>
          )}
          <p className="text-body text-neutral-700">
            The membership fee is <span className="font-mono">{formatPeso(fee)}</span>. Pay it to one of these, then enter the reference number here.
          </p>
          {methods.length > 0 && (
            <ul className="flex flex-col gap-1 text-small text-neutral-700">
              {methods.map((m) => (
                <li key={m.name}>
                  <span className="font-medium">{m.name}</span> · {m.accountName} · <span className="font-mono">{m.number}</span>
                  {m.note ? ` · ${m.note}` : ''}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            {methods.length > 0 ? (
              <Select label="Paid with" value={method} onChange={(e) => setMethod(e.target.value)}>
                {methods.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Paid with" value={method} onChange={(e) => setMethod(e.target.value)} />
            )}
            <Input label="Reference number" value={reference} onChange={(e) => setReference(e.target.value)} error={error} className="font-mono" />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Send payment'}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

function Details({ page }: { page: AthleteData }) {
  const { profile } = page
  const clubs = useClubs()
  const coaches = useCoaches()
  const save = useSaveMyAthlete()
  const [name, setName] = useState(profile.name)
  const [birthDate, setBirthDate] = useState(profile.birthDate)
  const [phone, setPhone] = useState(profile.phone)
  const [province, setProvince] = useState(profile.province)
  const [address, setAddress] = useState(profile.address)
  const [clubId, setClubId] = useState(profile.clubId ?? '')
  const [coachId, setCoachId] = useState(profile.coachId ?? '')
  const [error, setError] = useState<string | undefined>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter your name.')
    setError(undefined)
    save.mutate(
      { name, birthDate, phone, province, address, clubId: clubId || null, coachId: coachId || null },
      { onSuccess: () => toast.success('Saved'), onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="details">
      <h2 id="details" className="text-title font-semibold text-neutral-900">
        Your details
      </h2>
      <p className="text-small text-neutral-600">Only the secretariat sees these. They use them for your entry form.</p>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <Input label="Email" value={profile.email} disabled readOnly />
        <Input label="Date of birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Select label="Club" value={clubId} onChange={(e) => setClubId(e.target.value)}>
          <option value="">No club yet</option>
          {(clubs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">No coach</option>
          {(coaches.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </section>
  )
}

export function AthletePage() {
  const athlete = useMyAthlete()

  if (athlete.isError) return <ErrorState onRetry={() => void athlete.refetch()} />

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <PageHeader title="Your page" description="Your membership and the details the secretariat uses for your entries." />
      {athlete.data ? (
        <>
          <Membership page={athlete.data} />
          <Details page={athlete.data} />
        </>
      ) : (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  )
}
