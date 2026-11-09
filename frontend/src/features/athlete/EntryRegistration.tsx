import { PayMethod, type Event } from '@bis/shared'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, EmptyState, Pagination, Select, Skeleton, SkeletonList, Table, toast } from '../../components/ui/index.ts'
import {
  useCancelEntryRequest,
  useCompetitions,
  useEntryPaymentMethods,
  useEvents,
  useMyEntrants,
  useMyEntryRequests,
  useQuoteMyEntries,
  useSubmitEntryRequest,
  useCatalog,
} from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { competitorName, eventCode, eventDances, formatDate, formatDateTime, formatPeso, todayIso } from '../../lib/format.ts'
import { screenshotImage } from '../../lib/image.ts'
import { AccountSection } from './AccountSection.tsx'

// The events a dancer or couple can enter: solo events for one name, couple events for two, in their own age group
const fits = (event: Event, names: string[], ageGroup: string | null | undefined) =>
  event.isSolo === (names.length === 1) && (!ageGroup || event.ageGroup === ageGroup)

// The organizer names the ways to pay ("Bank transfer"); the entry stores one of GCash, Maya or bank
const payMethodOf = (name: string): PayMethod => (/gcash/i.test(name) ? PayMethod.GCash : /maya/i.test(name) ? PayMethod.Maya : PayMethod.Bank)

// Choose a competition, a dancer or couple and the events, see the fee, pay, and send it for the secretariat to approve
export function RegisterPage({ who }: { who: 'team' | 'athlete' }) {
  const { eventGrade } = useCatalog()
  const entrants = useMyEntrants()
  const competitions = useCompetitions()
  const methods = useEntryPaymentMethods()
  const submit = useSubmitEntryRequest()
  const [competitionId, setCompetitionId] = useState('')
  const [competitorId, setCompetitorId] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [method, setMethod] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>()
  const picker = useRef<HTMLInputElement>(null)

  const open = useMemo(() => (competitions.data ?? []).filter((c) => c.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date)), [competitions.data])
  const activeCompetition = competitionId || open[0]?.id || ''
  const list = entrants.data ?? []
  const dancer = list.find((r) => r.competitorId === competitorId) ?? list[0]
  const events = useEvents(activeCompetition || undefined)
  const eligible = useMemo(() => (dancer ? (events.data ?? []).filter((e) => fits(e, dancer.names, dancer.ageGroup)) : []), [events.data, dancer])
  const ids = chosen.filter((id) => eligible.some((e) => e.id === id))
  const quote = useQuoteMyEntries(dancer?.competitorId ?? '', ids)
  const { page, setPage, pageSize, total, pageItems } = usePagination(eligible, `${activeCompetition}|${dancer?.competitorId}`)
  const payWith = method || methods.data?.[0]?.name || ''
  const selectedMethod = (methods.data ?? []).find((m) => m.name === payWith)

  if (entrants.isLoading || competitions.isLoading) return <SkeletonList rows={5} className="max-w-3xl" />

  const intro = who === 'team' ? 'Pick a dancer or couple from your team, then the events.' : 'Pick yourself or a couple you dance in, then the events.'

  if (list.length === 0) {
    return (
      <AccountSection title="Enter events" note={intro}>
        <EmptyState
          title={who === 'team' ? 'No dancers to enter yet' : 'No dancer record with your name'}
          description={who === 'team' ? 'Dancers appear once the secretariat links your team and enters them from the entry form.' : 'The secretariat has no dancer or couple under your name yet.'}
        />
      </AccountSection>
    )
  }
  if (open.length === 0) {
    return (
      <AccountSection title="Enter events" note={intro}>
        <EmptyState title="No competition is open for entries" description="Upcoming competitions appear here once they are announced." />
      </AccountSection>
    )
  }

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      setReceipt(await screenshotImage(file))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  function send(event: FormEvent) {
    event.preventDefault()
    if (!dancer) return
    if (ids.length === 0) return setError('Choose at least one event.')
    if (!receipt) return setError('Send a screenshot of your payment.')
    setError(undefined)
    submit.mutate(
      { competitorId: dancer.competitorId, eventIds: ids, method: payMethodOf(payWith), reference: '', receipt },
      {
        onSuccess: () => {
          toast.success('Sent to the secretariat')
          setChosen([])
          setReceipt(null)
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <AccountSection title="Enter events" note={intro}>
      <div className="flex flex-col gap-10 lg:pr-[20rem]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Competition" required
              value={activeCompetition}
              onChange={(e) => {
                setCompetitionId(e.target.value)
                setChosen([])
              }}
            >
              {open.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {formatDate(c.date)}
                </option>
              ))}
            </Select>
            <Select
              label={who === 'team' ? 'Dancer or couple' : 'Entering as'} required
              value={dancer?.competitorId ?? ''}
              onChange={(e) => {
                setCompetitorId(e.target.value)
                setChosen([])
              }}
            >
              {list.map((r) => (
                <option key={r.competitorId} value={r.competitorId}>
                  {competitorName(r.names)}
                </option>
              ))}
            </Select>
          </div>

          {events.isLoading ? (
            <SkeletonList rows={5} />
          ) : eligible.length === 0 ? (
            <EmptyState title="No events for this dancer" description="This competition has no event for their age group and for a solo or couple entry." />
          ) : (
            <>
              <ul aria-label="Events" className="border-y border-neutral-200">
                {pageItems.map((e) => {
                  const on = ids.includes(e.id)
                  return (
                    <li key={e.id} className="border-t border-neutral-200 first:border-t-0">
                      <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gold-50', on && 'bg-gold-50')}>
                        <input type="checkbox" checked={on} onChange={() => toggle(e.id)} className="size-4 accent-neutral-900" aria-label={`Enter ${eventCode(e)}`} />
                        <span className="w-9 font-mono text-xs font-medium tabular-nums text-gold-700">{eventCode(e)}</span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-small font-semibold text-neutral-900">{eventDances(e)}</span>
                          <span className="text-xs text-neutral-600">{eventGrade(e)}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Events pagination" />}
            </>
          )}
        </div>

        <form
          onSubmit={send}
          noValidate
          className="flex flex-col border border-neutral-200 text-small lg:fixed lg:bottom-0 lg:right-0 lg:top-[var(--nav-h)] lg:z-20 lg:w-80 lg:border-y-0 lg:border-r-0 lg:bg-white"
        >
          {/* Only the middle scrolls, so the button is always in reach */}
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-mono text-xs uppercase text-neutral-500">Fee</h3>
              {quote.data && ids.length > 0 && <span className="font-mono text-body font-semibold tabular-nums text-neutral-900">{formatPeso(quote.data.total)}</span>}
            </div>
            {ids.length === 0 ? (
              <p className="text-neutral-600">Choose events to see the fee.</p>
            ) : quote.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : quote.data ? (
              <div className="flex flex-col gap-2">
                <ul className="flex flex-col gap-1">
                  {quote.data.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span className="text-neutral-600">{l.label}</span>
                      <span className="font-mono tabular-nums text-neutral-900">{formatPeso(l.amount)}</span>
                    </li>
                  ))}
                </ul>
                {quote.data.warnings.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                    {quote.data.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p role="alert" className="text-danger">
                {quote.error?.message}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
              <Select label="Pay with" required value={payWith} onChange={(e) => setMethod(e.target.value)}>
                {(methods.data ?? []).map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
              {selectedMethod && (
                <p className="flex items-baseline justify-between gap-4 bg-neutral-50 px-3 py-2">
                  <span className="text-neutral-600">{selectedMethod.accountName}</span>
                  <span className="font-mono tabular-nums text-neutral-900">{selectedMethod.number}</span>
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-neutral-600">Payment screenshot</span>
                <div className="flex items-center gap-3">
                  {receipt && <img src={receipt} alt="Your payment screenshot" className="h-10 w-7 border border-neutral-200 object-cover object-top" />}
                  <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
                    {receipt ? 'Change' : 'Choose'}
                  </Button>
                </div>
              </div>
              <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Payment screenshot" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
            </div>
            <p className="text-xs text-neutral-500">
              The secretariat checks your payment, then enters you. Follow it under{' '}
              <Link to={`/${who}/requests`} className="font-semibold text-neutral-900 underline decoration-gold-500 decoration-2 underline-offset-4">
                My requests
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-neutral-200 p-5 lg:p-6">
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={submit.isPending} className="w-full">
              {submit.isPending ? 'Sending…' : 'Send to the secretariat'}
            </Button>
          </div>
        </form>
      </div>
    </AccountSection>
  )
}

const TONE = { waiting: 'gold', approved: 'success', rejected: 'danger' } as const
const LABEL = { waiting: 'Waiting', approved: 'Approved', rejected: 'Not approved' } as const

// Every entry request sent, and what the secretariat decided
export function EntryRequestsList() {
  const requests = useMyEntryRequests()
  const cancel = useCancelEntryRequest()

  return (
    <AccountSection title="My requests" note="What you sent to the secretariat, and what they decided.">
      <Table
        loading={requests.isLoading}
        rows={requests.data ?? []}
        rowKey={(r) => r.id}
        minWidthClass="min-w-0"
        paginationLabel="Requests pagination"
        detailTitle={(r) => competitorName(r.names)}
        empty={{ title: 'No requests yet', description: 'Entries you send appear here.' }}
        columns={[
          { key: 'who', header: 'Dancers', bold: true, cell: (r) => competitorName(r.names) },
          { key: 'competition', header: 'Competition', muted: true, hideBelow: 'md', cell: (r) => r.competitionName },
          { key: 'events', header: 'Events', mono: true, cell: (r) => r.eventNumbers.map((n) => `E${n}`).join(', ') },
          { key: 'sent', header: 'Sent', detailOnly: true, cell: (r) => formatDateTime(r.createdAt) },
          { key: 'decided', header: 'Decided', detailOnly: true, cell: (r) => (r.decidedAt ? formatDateTime(r.decidedAt) : '–') },
          { key: 'total', header: 'Total', align: 'right', mono: true, hideBelow: 'sm', cell: (r) => formatPeso(r.total) },
          {
            key: 'status',
            header: 'Status',
            cell: (r) => (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                {r.rejectedReason && <span className="text-small text-neutral-600">{r.rejectedReason}</span>}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-28',
            cell: (r) =>
              r.status === 'waiting' ? (
                <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id, { onError: (e) => toast.error(e.message) })}>
                  Cancel
                </Button>
              ) : null,
          },
        ]}
      />
    </AccountSection>
  )
}
