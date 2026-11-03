import { PaymentStatus, type PaymentDetail, type PaymentLine } from '@bis/shared'
import { Fact } from '../../components/Fact.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Drawer, Table } from '../../components/ui/index.ts'
import { useStaffUsers } from '../../hooks/index.ts'
import { DANCE_LABEL, competitorName, eventCode, formatDateTime, formatPeso } from '../../lib/format.ts'

// What one payment covers, and who recorded it. The secretariat records every payment; nothing is decided here.
export function PaymentReview({ payment, onClose }: { payment: PaymentDetail; onClose: () => void }) {
  const staff = useStaffUsers()
  const checker = staff.data?.find((s) => s.id === payment.checkedBy)?.name

  const note =
    payment.status === PaymentStatus.Unpaid
      ? 'Not paid yet. The secretariat records it under Late entries, Cash payments, once the money arrives.'
      : `Recorded${checker ? ` by ${checker}` : ''}${payment.checkedAt ? ` on ${formatDateTime(payment.checkedAt)}` : ''}.`

  return (
    <Drawer
      open
      onClose={onClose}
      title={payment.teamName}
      meta={<PaymentStatusBadge status={payment.status} />}
      footer={<p className="text-small text-neutral-600">{note}</p>}
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
