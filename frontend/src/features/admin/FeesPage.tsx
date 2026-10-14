import type { PaymentMethod, PaymentSettings } from '@bis/shared'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, IconButton, Input, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { usePaymentSettings, useSavePaymentSettings } from '../../hooks/index.ts'

const MAX_METHODS = 8
const blankMethod = (): PaymentMethod => ({ name: '', accountName: '', number: '', note: '' })
const isPesos = (v: string) => /^\d{1,6}$/.test(v.trim())

function FeesEditor({ saved }: { saved: PaymentSettings }) {
  const [solo, setSolo] = useState(String(saved.fees?.solo ?? ''))
  const [couple, setCouple] = useState(String(saved.fees?.couple ?? ''))
  const [methods, setMethods] = useState<PaymentMethod[]>(saved.methods.map((m) => ({ ...m, note: m.note ?? '' })))
  const [failure, setFailure] = useState<string | null>(null)
  const save = useSavePaymentSettings()

  const change = (i: number, key: keyof PaymentMethod) => (e: { target: { value: string } }) =>
    setMethods((all) => all.map((m, j) => (j === i ? { ...m, [key]: e.target.value } : m)))
  const incomplete = methods.some((m) => !m.name.trim() || !m.accountName.trim() || !m.number.trim())
  const valid = isPesos(solo) && isPesos(couple) && !incomplete

  function onSave() {
    setFailure(null)
    save.mutate(
      {
        fees: { solo: Number(solo), couple: Number(couple) },
        methods: methods.map((m) => (m.note?.trim() ? m : { name: m.name, accountName: m.accountName, number: m.number })),
      },
      { onSuccess: () => toast.success('Saved'), onError: (e) => setFailure(e.message) },
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-title font-semibold text-neutral-900">Entry fees</h2>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Input label="Solo, per event (₱)" inputMode="numeric" value={solo} onChange={(e) => setSolo(e.target.value)} error={solo && !isPesos(solo) ? 'Whole pesos' : undefined} />
          <Input label="Couple, per event (₱)" inputMode="numeric" value={couple} onChange={(e) => setCouple(e.target.value)} error={couple && !isPesos(couple) ? 'Whole pesos' : undefined} />
        </div>
        {!saved.fees && <p className="text-small text-neutral-600">Until the fees are saved, clubs cannot enter events.</p>}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-title font-semibold text-neutral-900">Where clubs send payment</h2>
        {methods.length === 0 && <p className="text-small text-neutral-600">None yet. Clubs see nothing to pay to.</p>}
        {methods.map((m, i) => (
          <div key={i} className="grid items-end gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input label="Name" hint={i === 0 ? 'GCash, Maya, a bank' : undefined} value={m.name} onChange={change(i, 'name')} />
            <Input label="Account name" value={m.accountName} onChange={change(i, 'accountName')} />
            <Input label="Number" value={m.number} onChange={change(i, 'number')} />
            <IconButton icon={Trash2} tone="danger" label={`Remove ${m.name || 'this way to pay'}`} onClick={() => setMethods((all) => all.filter((_, j) => j !== i))} />
            <div className="sm:col-span-4">
              <Input label="Note (optional)" value={m.note ?? ''} onChange={change(i, 'note')} />
            </div>
          </div>
        ))}
        <div>
          <Button variant="secondary" disabled={methods.length >= MAX_METHODS} onClick={() => setMethods((all) => [...all, blankMethod()])}>
            Add a way to pay
          </Button>
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-neutral-200 pt-4">
        <Button disabled={!valid || save.isPending} onClick={onSave}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {failure && (
          <p role="alert" className="text-small text-danger">
            {failure}
          </p>
        )}
      </div>
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
        <FeesEditor key={JSON.stringify(settings.data)} saved={settings.data} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-3">
          <Skeleton className="h-11 w-80" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </div>
  )
}
