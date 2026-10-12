import { PaymentStatus, type PaymentDetail, type PaymentLine } from '@bis/shared'
import { useState } from 'react'
import { Fact } from '../../components/Fact.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, Dialog, Drawer, Table, Textarea, toast } from '../../components/ui/index.ts'
import { useApprovePayment, useRejectPayment, useStaffUsers } from '../../hooks/index.ts'
import { DANCE_LABEL, competitorName, eventCode, formatDateTime, formatPeso } from '../../lib/format.ts'

function Decision({ payment }: { payment: PaymentDetail }) {
  const approve = useApprovePayment()
  const reject = useRejectPayment()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const missingReason = touched && !reason.trim()

  function doApprove() {
    approve.mutate(payment.id, {
      onSuccess: () => {
        setConfirmApprove(false)
        toast.success(`Approved ${payment.clubName}`)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  function doReject() {
    setTouched(true)
    if (!reason.trim()) return
    reject.mutate(
      { id: payment.id, reason },
      {
        onSuccess: () => toast.success(`Rejected ${payment.clubName}`),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-4">
        <Textarea
          label="Reason for rejecting"
          hint="The club sees this and can send the payment again."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={missingReason ? 'Give a reason before rejecting.' : undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={reject.isPending} onClick={doReject}>
            {reject.isPending ? 'Rejecting…' : 'Reject payment'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setRejecting(true)}>
          Reject
        </Button>
        <Button onClick={() => setConfirmApprove(true)}>Approve</Button>
      </div>
      <Dialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        title={`Approve ${formatPeso(payment.amountPaid ?? 0)}?`}
        description={`${payment.clubName}'s entries are confirmed once you approve.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmApprove(false)}>
              Cancel
            </Button>
            <Button disabled={approve.isPending} onClick={doApprove}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </>
        }
      />
    </>
  )
}

export function PaymentReview({ payment, onClose }: { payment: PaymentDetail; onClose: () => void }) {
  const staff = useStaffUsers()
  const [zoom, setZoom] = useState(false)
  const checker = staff.data?.find((s) => s.id === payment.checkedBy)?.name
  const mismatch = payment.amountPaid !== null && payment.amountPaid !== payment.amountDue

  const footer =
    payment.status === PaymentStatus.ForChecking ? (
      <Decision key={payment.id} payment={payment} />
    ) : (
      <div className="flex flex-col gap-1 text-small">
        {payment.status === PaymentStatus.Approved && (
          <p className="text-neutral-900">
            Approved{checker ? ` by ${checker}` : ''}
            {payment.checkedAt && ` on ${formatDateTime(payment.checkedAt)}`}.
          </p>
        )}
        {payment.status === PaymentStatus.Rejected && (
          <>
            <p className="text-neutral-900">
              Rejected{checker ? ` by ${checker}` : ''}
              {payment.checkedAt && ` on ${formatDateTime(payment.checkedAt)}`}.
            </p>
            <p className="text-neutral-600">Reason: {payment.rejectionReason}</p>
          </>
        )}
        {payment.status === PaymentStatus.Unpaid && (
          <p className="text-neutral-600">The club has not uploaded proof of payment yet.</p>
        )}
        {payment.status === PaymentStatus.PaidAtVenue && (
          <p className="text-neutral-600">Paid in cash at the venue; the secretariat recorded it.</p>
        )}
      </div>
    )

  return (
    <Drawer
      open
      onClose={onClose}
      title={payment.clubName}
      meta={<PaymentStatusBadge status={payment.status} />}
      footer={footer}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-6">
          <dl className="grid flex-1 gap-4">
            <Fact bare label="Amount due">{formatPeso(payment.amountDue)}</Fact>
            <Fact
              bare
              label="Amount entered"
              flag={mismatch ? `${formatPeso(Math.abs(payment.amountDue - (payment.amountPaid ?? 0)))} ${(payment.amountPaid ?? 0) < payment.amountDue ? 'short' : 'over'}` : undefined}
            >
              {payment.amountPaid !== null ? formatPeso(payment.amountPaid) : '–'}
            </Fact>
            <Fact bare label="Reference number">{payment.referenceNumber ?? '–'}</Fact>
          </dl>
          <div className="flex shrink-0 flex-col gap-2">
            <p className="text-xs text-neutral-500">Screenshot</p>
            {payment.receiptUrl ? (
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label="View the screenshot larger"
                className="w-fit overflow-hidden rounded-md border border-neutral-200 hover:border-neutral-400"
              >
                <img src={payment.receiptUrl} alt={`Payment screenshot from ${payment.clubName}`} className="h-36 w-auto" />
              </button>
            ) : (
              <p className="text-small text-neutral-500">None uploaded yet.</p>
            )}
          </div>
          <Dialog open={zoom} onClose={() => setZoom(false)} title="Payment screenshot" className="max-w-md">
            {payment.receiptUrl && (
              <img src={payment.receiptUrl} alt={`Payment screenshot from ${payment.clubName}`} className="w-full rounded-md" />
            )}
          </Dialog>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-small font-medium">
            Entries <span className="font-mono tabular-nums text-neutral-500">{payment.lines.length}</span>
          </h3>
          <Table<PaymentLine>
            minWidthClass="min-w-0"
            paginationLabel="Entries pagination"
            rows={payment.lines}
            rowKey={(l) => l.entryId}
            empty={{ title: 'No entries on this payment' }}
            columns={[
              { key: 'event', header: 'Event', cell: (l) => eventCode({ number: l.eventNumber }), mono: true },
              { key: 'dances', header: 'Dances', cell: (l) => l.dances.map((d) => DANCE_LABEL[d]).join(', ') },
              { key: 'who', header: 'Dancers', cell: (l) => competitorName(l.competitorNames) },
              { key: 'fee', header: 'Fee', cell: (l) => formatPeso(l.fee), mono: true, align: 'right' },
            ]}
          />
        </section>
      </div>
    </Drawer>
  )
}
