import { PaymentStatus, type PaymentDetail } from '@bis/shared'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, EmptyState, ErrorState, Input, PageHeader, Skeleton, Table, toast } from '../../components/ui/index.ts'
import { useClubPayments, usePaymentMethods, useSubmitPayment } from '../../hooks/index.ts'
import { formatPeso } from '../../lib/format.ts'

const MAX_BYTES = 5 * 1024 * 1024

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function ProofForm({ payment }: { payment: PaymentDetail }) {
  const submit = useSubmitPayment()
  const [amount, setAmount] = useState(String(payment.amountDue))
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState<{ name: string; url: string } | null>(null)
  const [errors, setErrors] = useState<{ amount?: string; reference?: string; receipt?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setErrors((x) => ({ ...x, receipt: 'Upload an image of the receipt.' }))
    if (file.size > MAX_BYTES) return setErrors((x) => ({ ...x, receipt: 'The image is over 5 MB. Upload a smaller one.' }))
    setErrors((x) => ({ ...x, receipt: undefined }))
    setReceipt({ name: file.name, url: await readDataUrl(file) })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    const found = {
      amount: Number.isFinite(value) && value > 0 ? undefined : 'Enter the amount you sent.',
      reference: reference.trim() ? undefined : 'Enter the reference number from your receipt.',
      receipt: receipt ? undefined : 'Upload a screenshot of your receipt.',
    }
    setErrors(found)
    if (found.amount || found.reference || !receipt) return
    setFailure(null)
    submit.mutate(
      { amountPaid: value, referenceNumber: reference, receiptUrl: receipt.url },
      { onSuccess: () => toast.success('Payment sent for checking'), onError: (e) => setFailure(e.message) },
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Input
        label="Amount sent"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
        className="font-mono tabular-nums"
      />
      <Input
        label="Reference number"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        error={errors.reference}
        className="font-mono"
      />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="receipt" className="text-small font-medium text-neutral-600">
          Screenshot of your receipt
        </label>
        <input
          id="receipt"
          type="file"
          accept="image/*"
          onChange={pick}
          aria-describedby="receipt-msg"
          className="text-small file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-small file:font-medium hover:file:bg-neutral-50"
        />
        <p id="receipt-msg" role={errors.receipt ? 'alert' : undefined} className={errors.receipt ? 'text-small text-danger' : 'text-small text-neutral-600'}>
          {errors.receipt ?? (receipt ? receipt.name : 'A clear image showing the amount and the reference number.')}
        </p>
      </div>
      {failure && (
        <p role="alert" className="text-small text-danger sm:col-span-2">
          {failure}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Send for checking'}
        </Button>
      </div>
    </form>
  )
}

export function PaymentsPage() {
  const payments = useClubPayments()
  const methods = usePaymentMethods()

  if (payments.isError) return <ErrorState onRetry={() => void payments.refetch()} />
  if (!payments.data) return <Skeleton className="h-40 w-full" />

  const main = payments.data.find((p) => p.id.startsWith('pay-club'))
  const open = main && (main.status === PaymentStatus.Unpaid || main.status === PaymentStatus.Rejected) && main.amountDue > 0

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Payments" description="Pay your entry fees, then send us the receipt to check." />

      {!main ? (
        <div className="rounded-xl border border-neutral-200 px-6">
          <EmptyState title="Nothing to pay yet" description="Register dancers to events and the amount due appears here." />
        </div>
      ) : (
        <section aria-label="Amount due" className="flex flex-col gap-6 border-y border-neutral-200 py-7">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Amount due</p>
              <p className="font-mono text-display font-semibold tabular-nums">{formatPeso(main.amountDue)}</p>
            </div>
            <PaymentStatusBadge status={main.status} />
          </div>

          {main.status === PaymentStatus.Rejected && (
            <p role="alert" className="text-small text-danger">
              Rejected: {main.rejectionReason} Fix it and send the receipt again.
            </p>
          )}
          {main.status === PaymentStatus.ForChecking && (
            <p className="text-small text-neutral-600">We have your receipt and are checking it. You will see the result here.</p>
          )}
          {main.status === PaymentStatus.Approved && <p className="text-small text-neutral-600">Paid and approved. See you at the competition.</p>}
          {main.status === PaymentStatus.PaidAtVenue && <p className="text-small text-neutral-600">Paid in cash at the venue.</p>}
        </section>
      )}

      {open && (
        <>
          <section aria-label="How to pay" className="flex flex-col gap-4">
            <h2 className="text-title font-semibold">How to pay</h2>
            {methods.data?.length === 0 && <p className="text-small text-neutral-600">The organizer has not added payment details yet. Check back soon.</p>}
            <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
              {(methods.data ?? []).map((m) => (
                <div key={m.name} className="flex flex-col gap-1">
                  <dt className="font-semibold text-neutral-900">{m.name}</dt>
                  <dd className="font-mono text-small tabular-nums text-neutral-900">{m.number}</dd>
                  <dd className="text-small text-neutral-600">{m.accountName}</dd>
                  {m.note && <dd className="text-small text-neutral-600">{m.note}</dd>}
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Send your receipt" className="flex flex-col gap-4">
            <h2 className="text-title font-semibold">Send your receipt</h2>
            <ProofForm key={main.id + main.status} payment={main} />
          </section>
        </>
      )}

      {payments.data.length > 0 && (
        <section aria-label="Payment history" className="flex flex-col gap-4">
          <h2 className="text-title font-semibold">Your payments</h2>
          <Table<PaymentDetail>
            rows={payments.data}
            rowKey={(p) => p.id}
            minWidthClass="min-w-0"
            paginationLabel="Payments pagination"
            detailTitle={(p) => (p.id.startsWith('pay-late') ? 'Late entry' : 'Registration')}
            empty={{ title: 'No payments yet' }}
            columns={[
              { key: 'what', header: 'For', cell: (p) => (p.id.startsWith('pay-late') ? 'Late entry' : 'Registration') },
              { key: 'due', header: 'Amount due', cell: (p) => formatPeso(p.amountDue), mono: true, align: 'right' },
              { key: 'paid', header: 'Amount sent', cell: (p) => (p.amountPaid !== null ? formatPeso(p.amountPaid) : '–'), mono: true, align: 'right', hideBelow: 'sm' },
              {
                key: 'status',
                header: 'Status',
                cell: (p) => (
                  <div className="flex flex-col items-start gap-1">
                    <PaymentStatusBadge status={p.status} />
                    {p.status === PaymentStatus.Rejected && p.rejectionReason && (
                      <span className="text-xs text-danger">{p.rejectionReason}</span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}
    </div>
  )
}
