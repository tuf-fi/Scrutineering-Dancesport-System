import type { PaymentMethod, PaymentSettings } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, ErrorState, IconButton, Input, PageHeader, Skeleton, Table, toast } from '../../components/ui/index.ts'
import { usePaymentSettings, useSavePaymentSettings } from '../../hooks/index.ts'
import { PaymentMethodDialog } from './PaymentMethodDialog.tsx'

const MAX_METHODS = 8
const isPesos = (v: string) => /^\d{1,6}$/.test(v.trim())

function FeesEditor({ saved }: { saved: PaymentSettings }) {
  const [solo, setSolo] = useState(String(saved.fees?.solo ?? ''))
  const [couple, setCouple] = useState(String(saved.fees?.couple ?? ''))
  const methods = saved.methods
  const [failure, setFailure] = useState<string | null>(null)
  // The way to pay being edited by index, or 'new' while adding one
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [toRemove, setToRemove] = useState<number | null>(null)
  const save = useSavePaymentSettings()

  const valid = isPesos(solo) && isPesos(couple)

  const clean = (all: PaymentMethod[]) =>
    all.map((m) => (m.note?.trim() ? m : { name: m.name, accountName: m.accountName, number: m.number }))

  // Entry fees are saved with the button
  function onSave() {
    setFailure(null)
    save.mutate(
      { fees: { solo: Number(solo), couple: Number(couple) }, methods: clean(methods) },
      { onSuccess: () => toast.success('Fees saved'), onError: (e) => setFailure(e.message) },
    )
  }

  // Ways to pay are saved as soon as one is added, edited or removed
  function persistMethods(next: PaymentMethod[], done: string) {
    if (!saved.fees) return toast.error('Save the entry fees first.')
    save.mutate({ fees: saved.fees, methods: clean(next) }, { onSuccess: () => toast.success(done), onError: (e) => toast.error(e.message) })
  }

  function saveMethod(method: PaymentMethod) {
    const adding = editing === 'new'
    persistMethods(adding ? [...methods, method] : methods.map((m, i) => (i === editing ? method : m)), adding ? 'Way to pay added' : 'Way to pay updated')
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold text-neutral-900">Entry fees</h2>
          <p className="text-small text-neutral-600">Charged to the club for each event entered.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid w-full max-w-md grid-cols-2 gap-4">
          <Input label="Solo, per event (₱)" inputMode="numeric" className="font-mono tabular-nums" value={solo} onChange={(e) => setSolo(e.target.value)} error={solo && !isPesos(solo) ? 'Whole pesos' : undefined} />
          <Input label="Couple, per event (₱)" inputMode="numeric" className="font-mono tabular-nums" value={couple} onChange={(e) => setCouple(e.target.value)} error={couple && !isPesos(couple) ? 'Whole pesos' : undefined} />
          </div>
          <Button className="rounded-lg sm:ml-auto" disabled={!valid || save.isPending} onClick={onSave}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {failure && (
          <p role="alert" className="text-small text-danger">
            {failure}
          </p>
        )}
        {!saved.fees && <p className="text-small text-neutral-600">Until the fees are saved, clubs cannot enter events.</p>}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-title font-semibold text-neutral-900">Where clubs send payment</h2>
            <p className="text-small text-neutral-600">GCash, Maya or a bank. Clubs see these when they pay.</p>
          </div>
          <Button className="rounded-lg" disabled={methods.length >= MAX_METHODS} onClick={() => setEditing('new')}>
            Add a way to pay
          </Button>
        </div>
        <Table<PaymentMethod>
          rows={methods}
          rowKey={(m) => `${m.name}-${m.number}`}
          minWidthClass="min-w-0"
          paginationLabel="Ways to pay pagination"
          empty={{ title: 'No ways to pay yet', description: 'Clubs see nothing to pay to until you add one.' }}
          columns={[
            { key: 'name', header: 'Name', cell: (m) => <span className="font-medium text-neutral-900">{m.name}</span> },
            { key: 'account', header: 'Account name', cell: (m) => m.accountName, muted: true },
            { key: 'number', header: 'Number', cell: (m) => m.number, mono: true, hideBelow: 'sm' },
            { key: 'note', header: 'Note', cell: (m) => m.note || '–', muted: true, hideBelow: 'md' },
            {
              key: 'actions',
              header: '',
              align: 'right',
              widthClass: 'w-20',
              cell: (m) => {
                const i = methods.indexOf(m)
                return (
                  <div className="flex justify-end gap-0.5">
                    <IconButton icon={Pencil} label={`Edit ${m.name}`} onClick={() => setEditing(i)} />
                    <IconButton icon={Trash2} tone="danger" label={`Remove ${m.name}`} onClick={() => setToRemove(i)} />
                  </div>
                )
              },
            },
          ]}
        />
      </section>

      <PaymentMethodDialog
        open={editing !== null}
        method={typeof editing === 'number' ? (methods[editing] ?? null) : null}
        onClose={() => setEditing(null)}
        onSave={saveMethod}
      />
      <Dialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title="Remove this way to pay?"
        description={`${toRemove !== null ? (methods[toRemove]?.name ?? '') : ''} stops showing to clubs.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={save.isPending}
              onClick={() => {
                persistMethods(methods.filter((_, j) => j !== toRemove), 'Way to pay removed')
                setToRemove(null)
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </div>
  )
}

export function FeesPage() {
  const settings = usePaymentSettings()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fees and payment details" description="What clubs pay per event and where they send it." />
      {settings.isError ? (
        <ErrorState onRetry={() => void settings.refetch()} />
      ) : settings.data ? (
        <FeesEditor key={JSON.stringify(settings.data.fees)} saved={settings.data} />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-80" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </div>
  )
}
