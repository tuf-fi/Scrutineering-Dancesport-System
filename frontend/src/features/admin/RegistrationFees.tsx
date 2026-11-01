import type { FeeSchedule, FeeTier, PaymentMethod, PaymentSettings } from '@bis/shared'
import { DEFAULT_FEE_SCHEDULE } from '@bis/shared'
import { useState } from 'react'
import { Button, Input, toast } from '../../components/ui/index.ts'
import { useSavePaymentSettings } from '../../hooks/index.ts'

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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-neutral-900">Registration fees</h2>
        <p className="text-small text-neutral-600">What the secretariat charges when it enters a team from an entry form.</p>
      </div>
      <div className="grid max-w-2xl gap-x-4 gap-y-3 sm:grid-cols-[1fr_8rem_8rem]">
        <span className="hidden text-small font-medium text-neutral-600 sm:block">Events</span>
        <span className="hidden text-small font-medium text-neutral-600 sm:block">First entry (₱)</span>
        <span className="hidden text-small font-medium text-neutral-600 sm:block">Each extra (₱)</span>
        {TIERS.map(({ key, label }) => (
          <div key={key} className="contents">
            <span className="self-center text-small text-neutral-900">{label}</span>
            <Input label={`${label}, first entry`} hideLabel inputMode="numeric" className="font-mono tabular-nums" value={draft[`${key}.first`]!} onChange={set(`${key}.first`)} error={error(`${key}.first`)} />
            <Input label={`${label}, each extra entry`} hideLabel inputMode="numeric" className="font-mono tabular-nums" value={draft[`${key}.additional`]!} onChange={set(`${key}.additional`)} error={error(`${key}.additional`)} />
          </div>
        ))}
        {SINGLES.map(({ key, label }) => (
          <div key={key} className="contents">
            <span className="self-center text-small text-neutral-900">{label}</span>
            <Input label={`${label} (₱)`} hideLabel inputMode="numeric" className="font-mono tabular-nums" value={draft[key]!} onChange={set(key)} error={error(key)} />
            <span aria-hidden className="hidden sm:block" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="rounded-lg" disabled={!dirty || !valid || save.isPending} onClick={onSave}>
          {save.isPending ? 'Saving…' : 'Save registration fees'}
        </Button>
        <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(original)}>
          Discard changes
        </Button>
        {failure && (
          <p role="alert" className="text-small text-danger">
            {failure}
          </p>
        )}
      </div>
    </section>
  )
}
