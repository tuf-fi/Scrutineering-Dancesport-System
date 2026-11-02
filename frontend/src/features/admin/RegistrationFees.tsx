import type { FeeSchedule, FeeTier, PaymentMethod, PaymentSettings } from '@bis/shared'
import { DEFAULT_FEE_SCHEDULE } from '@bis/shared'
import { useState } from 'react'
import { Button, Input, toast } from '../../components/ui/index.ts'
import { useSavePaymentSettings } from '../../hooks/index.ts'
import { SectionHead } from './SectionHead.tsx'

const isPesos = (v: string) => /^\d{1,6}$/.test(v.trim())

const TIERS: Array<{ key: 'soloJuvenile' | 'soloOlder' | 'coupleJuvenile' | 'coupleOlder'; label: string }> = [
  { key: 'soloJuvenile', label: 'Solo, juvenile' },
  { key: 'soloOlder', label: 'Solo, junior and youth' },
  { key: 'coupleJuvenile', label: 'Couple, juvenile and inter-elementary' },
  { key: 'coupleOlder', label: 'Couple, junior, youth and inter-high school' },
]

const SINGLES: Array<{ key: 'fixed' | 'athleteMembership' | 'coachMembership' | 'coachesSummit'; label: string }> = [
  { key: 'fixed', label: 'Ranking and inter-collegiate events' },
  { key: 'athleteMembership', label: 'Athlete membership, per athlete' },
  { key: 'coachMembership', label: 'Coach membership' },
  { key: 'coachesSummit', label: 'Coaches Summit' },
]

type Draft = Record<string, string>

const toDraft = (s: FeeSchedule): Draft => ({
  ...Object.fromEntries(TIERS.flatMap(({ key }) => [[`${key}.first`, String(s[key].first)], [`${key}.additional`, String(s[key].additional)]])),
  ...Object.fromEntries(SINGLES.map(({ key }) => [key, String(s[key])])),
})

const tier = (d: Draft, key: string): FeeTier => ({ first: Number(d[`${key}.first`]), additional: Number(d[`${key}.additional`]) })

// The prices the secretariat charges from an entry form: the first entry, each extra entry, and the fixed fees
export function RegistrationFees({ saved }: { saved: PaymentSettings }) {
  const schedule = saved.schedule ?? DEFAULT_FEE_SCHEDULE
  const original = toDraft(schedule)
  const [draft, setDraft] = useState<Draft>(original)
  const [failure, setFailure] = useState<string | null>(null)
  const save = useSavePaymentSettings()

  const dirty = Object.keys(draft).some((k) => draft[k]!.trim() !== original[k])
  const valid = Object.values(draft).every(isPesos)
  const set = (key: string) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const error = (key: string) => (draft[key]! && !isPesos(draft[key]!) ? 'Whole pesos' : undefined)

  function onSave() {
    setFailure(null)
    const next: FeeSchedule = {
      soloJuvenile: tier(draft, 'soloJuvenile'),
      soloOlder: tier(draft, 'soloOlder'),
      coupleJuvenile: tier(draft, 'coupleJuvenile'),
      coupleOlder: tier(draft, 'coupleOlder'),
      fixed: Number(draft.fixed),
      athleteMembership: Number(draft.athleteMembership),
      coachMembership: Number(draft.coachMembership),
      coachesSummit: Number(draft.coachesSummit),
    }
    const methods: PaymentMethod[] = saved.methods
    save.mutate({ fees: saved.fees, methods, schedule: next }, { onSuccess: () => toast.success('Registration fees saved'), onError: (e) => setFailure(e.message) })
  }

  const field = 'h-9! bg-white px-2.5 text-right font-mono tabular-nums'
  const changed = Object.keys(draft).filter((k) => draft[k]!.trim() !== original[k]).length

  return (
    <section className="flex flex-col gap-6">
      <SectionHead title="Registration fees" note="What the secretariat charges when it enters a team from an entry form." />

      <div className="flex flex-col gap-3">
        <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-x-3 font-mono text-xs uppercase text-neutral-500">
          <span>Events</span>
          <span className="text-right">First (₱)</span>
          <span className="text-right">Each extra (₱)</span>
        </div>
        <ul className="border-y border-neutral-200">
          {TIERS.map(({ key, label }) => (
            <li key={key} className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] items-center gap-x-3 border-t border-neutral-200 py-2.5 first:border-t-0">
              <span className="text-small text-neutral-900">{label}</span>
              <Input label={`${label}, first entry`} hideLabel inputMode="numeric" className={field} value={draft[`${key}.first`]!} onChange={set(`${key}.first`)} error={error(`${key}.first`)} />
              <Input label={`${label}, each extra entry`} hideLabel inputMode="numeric" className={field} value={draft[`${key}.additional`]!} onChange={set(`${key}.additional`)} error={error(`${key}.additional`)} />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <p aria-hidden className="font-mono text-xs uppercase text-neutral-500">Fixed fees</p>
        <ul className="border-y border-neutral-200">
          {SINGLES.map(({ key, label }) => (
            <li key={key} className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-3 border-t border-neutral-200 py-2.5 first:border-t-0">
              <span className="text-small text-neutral-900">{label}</span>
              <Input label={`${label} (₱)`} hideLabel inputMode="numeric" className={field} value={draft[key]!} onChange={set(key)} error={error(key)} />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role={failure ? 'alert' : undefined} className={failure ? 'text-small text-danger' : dirty ? 'text-small font-medium text-neutral-900' : 'text-small text-neutral-500'}>
          {failure ?? (dirty ? `${changed} unsaved ${changed === 1 ? 'change' : 'changes'}` : 'All changes saved')}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(original)}>
            Discard
          </Button>
          <Button disabled={!dirty || !valid || save.isPending} onClick={onSave}>
            {save.isPending ? 'Saving…' : 'Save registration fees'}
          </Button>
        </div>
      </div>
    </section>
  )
}
