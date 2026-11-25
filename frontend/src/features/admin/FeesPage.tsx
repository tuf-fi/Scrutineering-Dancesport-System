import type { PaymentMethod, PaymentSettings } from '@bis/shared'
import { IdCard, Landmark, Pencil, Receipt, Trash2, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Dialog, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { SectionSidebar } from '../../app/layouts/SectionSidebar.tsx'
import { useSection } from '../../app/layouts/useSection.ts'
import { usePaymentSettings, useSavePaymentSettings } from '../../hooks/index.ts'
import { PaymentMethodDialog } from './PaymentMethodDialog.tsx'
import { EventFees } from './EventFees.tsx'
import { MembershipFeesForm } from './MembershipFeesForm.tsx'
import { SectionHead } from './SectionHead.tsx'

const MAX_METHODS = 8

// The parts of this page, each in its own place in the side menu. "accounts" is where teams and athletes send payment.
const SECTIONS = [
  { id: 'events', label: 'Event fees', icon: Receipt },
  { id: 'memberships', label: 'Memberships', icon: IdCard },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>
type SectionId = (typeof SECTIONS)[number]['id']

// The sections stay on the page, only one in view, so what was typed in one is still there after looking at another
function Pane({ id, current, children }: { id: SectionId; current: SectionId; children: ReactNode }) {
  return (
    <div id={`fees-${id}`} hidden={id !== current}>
      {children}
    </div>
  )
}

function FeesEditor({ saved }: { saved: PaymentSettings }) {
  const methods = saved.methods
  // The way to pay being edited by index, or 'new' while adding one
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [toRemove, setToRemove] = useState<number | null>(null)
  const save = useSavePaymentSettings()
  const current = useSection(SECTIONS) as SectionId

  const clean = (all: PaymentMethod[]) => all.map((m) => (m.note?.trim() ? m : { name: m.name, accountName: m.accountName, number: m.number }))

  // Ways to pay are saved as soon as one is added, edited or removed
  function persistMethods(next: PaymentMethod[], done: string) {
    save.mutate(
      { memberships: saved.memberships, methods: clean(next) },
      {
        onSuccess: () => toast.success(done),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  function saveMethod(method: PaymentMethod) {
    const adding = editing === 'new'
    persistMethods(adding ? [...methods, method] : methods.map((m, i) => (i === editing ? method : m)), adding ? 'Way to pay added' : 'Way to pay updated')
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionSidebar title="Fees" label="Fee sections" sections={SECTIONS} current={current} />

      <div className="min-w-0">
        <Pane id="events" current={current}>
          <EventFees />
        </Pane>

        <Pane id="memberships" current={current}>
          <MembershipFeesForm saved={saved} />
        </Pane>

        <Pane id="accounts" current={current}>
          <section className="flex flex-col gap-6">
            <SectionHead
              title="Payment accounts"
              note="GCash, Maya or a bank. Teams see these when they pay."
              action={
                <Button disabled={methods.length >= MAX_METHODS} onClick={() => setEditing('new')}>
                  Add a way to pay
                </Button>
              }
            />
            {methods.length === 0 ? (
              <EmptyState title="No payment accounts yet" description="Teams see nothing to pay to until you add one." />
            ) : (
              <ul aria-label="Payment accounts" className="border-y border-neutral-200">
                {methods.map((m, i) => (
                  <li
                    key={`${m.name}-${m.number}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-t border-neutral-200 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:gap-x-8"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold text-neutral-900">{m.name}</span>
                      <span className="text-small text-neutral-600">{m.accountName}</span>
                    </div>
                    <div className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-1">
                      <span className="whitespace-nowrap font-mono text-body tabular-nums text-neutral-900">{m.number}</span>
                      {m.note && <span className="text-small text-neutral-500">{m.note}</span>}
                    </div>
                    <div className="col-start-2 row-start-1 flex justify-end gap-0.5 sm:col-start-auto sm:row-start-auto">
                      <IconButton icon={Pencil} label={`Edit ${m.name}`} onClick={() => setEditing(i)} />
                      <IconButton icon={Trash2} tone="danger" label={`Remove ${m.name}`} onClick={() => setToRemove(i)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Pane>
      </div>

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
        description={`${toRemove !== null ? (methods[toRemove]?.name ?? '') : ''} stops showing to teams.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={save.isPending}
              onClick={() => {
                persistMethods(
                  methods.filter((_, j) => j !== toRemove),
                  'Way to pay removed',
                )
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
    <div className="flex flex-col gap-8 lg:ml-[13rem]">
      <PageHeader title="Fees and payment details" description="What entries cost, and where teams send payment." />
      {settings.isError ? (
        <ErrorState onRetry={() => void settings.refetch()} />
      ) : settings.data ? (
        <FeesEditor key={JSON.stringify(settings.data.memberships)} saved={settings.data} />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-80" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </div>
  )
}
