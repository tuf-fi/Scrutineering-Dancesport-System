import type { MembershipFees, PaymentSettings } from '@bis/shared'
import { useState } from 'react'
import { Button, Input, toast } from '../../components/ui/index.ts'
import { useSavePaymentSettings } from '../../hooks/index.ts'
import { SectionHead } from './SectionHead.tsx'

const isPesos = (v: string) => /^\d{1,6}$/.test(v.trim())

const FIELDS: Array<{ key: keyof MembershipFees; label: string }> = [
  { key: 'athlete', label: 'Athlete membership, per athlete' },
  { key: 'coach', label: 'Coach membership' },
  { key: 'summit', label: 'Coaches Summit' },
]

const toDraft = (m: MembershipFees) => ({ athlete: String(m.athlete), coach: String(m.coach), summit: String(m.summit) })

// The yearly fees, the same for every competition
export function MembershipFeesForm({ saved }: { saved: PaymentSettings }) {
  const original = toDraft(saved.memberships)
  const [draft, setDraft] = useState(original)
  const [failure, setFailure] = useState<string | null>(null)
  const save = useSavePaymentSettings()

  const changed = FIELDS.filter(({ key }) => draft[key].trim() !== original[key]).length
  const valid = Object.values(draft).every(isPesos)

  function onSave() {
    setFailure(null)
    save.mutate(
      { methods: saved.methods, memberships: { athlete: Number(draft.athlete), coach: Number(draft.coach), summit: Number(draft.summit) } },
      { onSuccess: () => toast.success('Membership fees saved'), onError: (e) => setFailure(e.message) },
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <SectionHead title="Memberships" note="Paid once a year, the same for every competition. Enter 0 to stop charging one." />
      <ul className="border-y border-neutral-200">
        {FIELDS.map(({ key, label }) => (
          <li key={key} className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-3 border-t border-neutral-200 py-2.5 first:border-t-0">
            <span className="text-small text-neutral-900">{label}</span>
            <Input
              label={`${label} (₱)`}
              hideLabel
              inputMode="numeric"
              className="h-9! bg-white px-2.5 text-right font-mono tabular-nums"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              error={draft[key] && !isPesos(draft[key]) ? 'Whole pesos' : undefined}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role={failure ? 'alert' : undefined} className={failure ? 'text-small text-danger' : changed ? 'text-small font-medium text-neutral-900' : 'text-small text-neutral-500'}>
          {failure ?? (changed ? `${changed} unsaved ${changed === 1 ? 'change' : 'changes'}` : 'All changes saved')}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!changed} onClick={() => setDraft(original)}>
            Discard
          </Button>
          <Button disabled={!changed || !valid || save.isPending} onClick={onSave}>
            {save.isPending ? 'Saving…' : 'Save membership fees'}
          </Button>
        </div>
      </div>
    </section>
  )
}
