import type { EntryOption } from '@bis/shared'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button, EmptyState, ErrorState, PageHeader, Select, Skeleton, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useClubDancers, useClubPayments, useEntryOptions, useRegisterEntries } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, competitorName, eventCode, eventDances, formatPeso } from '../../lib/format.ts'

function Picker({ dancerId, dancerName }: { dancerId: string; dancerName: string }) {
  const options = useEntryOptions(dancerId)
  const payments = useClubPayments()
  const register = useRegisterEntries()
  // The ticked events, starting from what is already saved
  const [chosen, setChosen] = useState<Set<string> | null>(null)

  const saved = useMemo(() => new Set((options.data ?? []).filter((o) => o.entered).map((o) => o.eventId)), [options.data])
  const ticked = chosen ?? saved
  const dirty = ticked.size !== saved.size || [...ticked].some((id) => !saved.has(id))

  if (options.isError) return <ErrorState onRetry={() => void options.refetch()} />

  const fee = new Map((options.data ?? []).map((o) => [o.eventId, o.fee]))
  const forDancer = [...ticked].reduce((sum, id) => sum + (fee.get(id) ?? 0), 0)
  const savedForDancer = [...saved].reduce((sum, id) => sum + (fee.get(id) ?? 0), 0)
  // The club's total changes by what this dancer's ticks add or remove
  const clubDue = (payments.data?.find((p) => p.id.startsWith('pay-club'))?.amountDue ?? 0) + forDancer - savedForDancer

  function toggle(id: string) {
    const next = new Set(ticked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  function save() {
    register.mutate(
      { dancerId, eventIds: [...ticked] },
      {
        onSuccess: () => {
          setChosen(null)
          toast.success(`Entries saved for ${dancerName}`)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Table<EntryOption>
        loading={options.isLoading}
        rows={options.data ?? []}
        rowKey={(o) => o.eventId}
        minWidthClass="min-w-0"
        paginationLabel="Events pagination"
        empty={{ title: 'No events open to this dancer', description: 'Check the dancer’s age group and whether they are solo or a couple.' }}
        columns={[
          {
            key: 'pick',
            header: 'Enter',
            widthClass: 'w-20',
            cell: (o) => (
              <input
                type="checkbox"
                aria-label={`Enter ${eventCode({ number: o.eventNumber })} ${eventDances(o)}`}
                checked={ticked.has(o.eventId)}
                disabled={o.locked}
                onChange={() => toggle(o.eventId)}
                className="size-5 accent-neutral-900"
              />
            ),
          },
          {
            key: 'event',
            header: 'Event',
            cell: (o) => (
              <span className="font-medium">
                <span className="mr-2 font-mono tabular-nums text-neutral-500">{eventCode({ number: o.eventNumber })}</span>
                {eventDances(o)}
                {o.locked && <span className="ml-2 text-xs font-normal text-neutral-500">Paid, locked</span>}
              </span>
            ),
          },
          {
            key: 'grade',
            header: 'Grade',
            cell: (o) => `${AGE_GROUP_LABEL[o.ageGroup]} · ${o.class} · ${DISCIPLINE_LABEL[o.discipline]}`,
            muted: true,
            hideBelow: 'md',
          },
          { key: 'fee', header: 'Fee', cell: (o) => formatPeso(o.fee), mono: true, align: 'right' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-5">
        <dl className="flex flex-wrap gap-x-10 gap-y-3" aria-label="Fee total">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-neutral-500">{dancerName}</dt>
            <dd className="font-mono text-title font-semibold tabular-nums">
              {ticked.size} event{ticked.size === 1 ? '' : 's'} · {formatPeso(forDancer)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-neutral-500">Your club owes</dt>
            <dd className="font-mono text-title font-semibold tabular-nums">{formatPeso(Math.max(0, clubDue))}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-3">
          <Link to="/club/payments" className="text-small font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
            Go to payment
          </Link>
          <Button disabled={!dirty || register.isPending} onClick={save}>
            {register.isPending ? 'Saving…' : 'Save entries'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function EntriesPage() {
  const dancers = useClubDancers()
  const [dancerId, setDancerId] = useState('')

  if (dancers.isError) return <ErrorState onRetry={() => void dancers.refetch()} />

  const list = dancers.data ?? []
  const current = list.find((d) => d.id === dancerId) ?? list[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Events" description="Choose a dancer, tick the events they will dance, and see what your club owes." />

      {!dancers.data ? (
        <Skeleton className="h-24 w-full max-w-xl" />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 px-6">
          <EmptyState
            title="Add a dancer first"
            description="Entries are made for a dancer."
            action={
              <Link to="/club" className="text-small font-medium underline underline-offset-4">
                Go to dancers
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <Toolbar>
            <div className="w-full sm:w-80">
              <Select label="Dancer" value={current.id} onChange={(e) => setDancerId(e.target.value)}>
                {list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {competitorName(d.names)}
                  </option>
                ))}
              </Select>
            </div>
            <ToolbarActions>
              <span className="text-small text-neutral-600">
                {current.ageGroup ? AGE_GROUP_LABEL[current.ageGroup] : 'Any age group'} · {current.names.length === 1 ? 'Solo' : 'Couple'}
              </span>
            </ToolbarActions>
          </Toolbar>
          <Picker key={current.id} dancerId={current.id} dancerName={competitorName(current.names)} />
        </>
      )}
    </div>
  )
}
