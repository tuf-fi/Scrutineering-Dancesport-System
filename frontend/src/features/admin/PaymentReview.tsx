import { PaymentStatus, type PaymentDetail, type PaymentLine } from '@bis/shared'
import { Fact } from '../../components/Fact.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, Drawer, Table, toast } from '../../components/ui/index.ts'
import { useMarkPaidAtVenue, useStaffUsers } from '../../hooks/index.ts'
import { DANCE_LABEL, competitorName, eventCode, formatDateTime, formatPeso } from '../../lib/format.ts'

// What one payment covers, and who confirmed it. The admin keeps the record and can confirm a cash payment here; the secretariat only confirms.
export function PaymentReview({ payment, onClose }: { payment: PaymentDetail; onClose: () => void }) {
  const staff = useStaffUsers()
  const markPaid = useMarkPaidAtVenue()
  const open = payment.status === PaymentStatus.Unpaid || payment.status === PaymentStatus.Rejected
  const checker = staff.data?.find((s) => s.id === payment.checkedBy)?.name

  const note =
    payment.status === PaymentStatus.Unpaid
      ? 'Not paid yet. Confirm it once the money has arrived.'
      : `Confirmed${checker ? ` by ${checker}` : ''}${payment.checkedAt ? ` on ${formatDateTime(payment.checkedAt)}` : ''}.`

  return (
    <Drawer
      open
      onClose={onClose}
      title={payment.teamName}
      meta={<PaymentStatusBadge status={payment.status} />}
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-small text-neutral-600">{note}</p>
          {open && (
            <Button
              disabled={markPaid.isPending}
              onClick={() =>
                markPaid.mutate(payment.id, {
                  onSuccess: () => toast.success(`${payment.teamName} confirmed as paid`),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              {markPaid.isPending ? 'Saving…' : 'Confirm payment'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <dl className="grid gap-4">
          <Fact bare label="Amount due">{formatPeso(payment.amountDue)}</Fact>
          <Fact bare label="Amount paid">{payment.amountPaid !== null ? formatPeso(payment.amountPaid) : '–'}</Fact>
          <Fact bare label="Reference number">{payment.referenceNumber ?? '–'}</Fact>
        </dl>

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
