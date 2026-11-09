import { monthYearText, parseMonthYear } from '@bis/shared'
import type { CompetitorDetails, CompetitorRow, DancerDetails, Gender } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useTeams, useCoaches, useCreateCompetitor, useUpdateCompetitor } from '../../hooks/index.ts'

const FORM_ID = 'competitor-form'

const BLANK: DancerDetails = { birthDate: '', gender: '', address: '', email: '', phone: '' }

function CompetitorForm({ competitor, onDone, onAdded }: { competitor: CompetitorRow | null; onDone: () => void; onAdded?: () => void }) {
  const teams = useTeams()
  const coaches = useCoaches()
  const create = useCreateCompetitor()
  const update = useUpdateCompetitor()
  const saved = competitor?.details
  const [first, setFirst] = useState(competitor?.names[0] ?? '')
  const [second, setSecond] = useState(competitor?.names[1] ?? '')
  const [teamId, setTeamId] = useState(competitor?.teamId ?? '')
  const [province, setProvince] = useState(saved?.province ?? '')
  const [coachId, setCoachId] = useState(saved?.coachId ?? '')
  const [beginner, setBeginner] = useState(saved?.beginner ?? false)
  const [memberYear, setMemberYear] = useState(monthYearText(saved?.memberMonth, saved?.memberYear))
  const [dancers, setDancers] = useState<DancerDetails[]>([saved?.dancers[0] ?? BLANK, saved?.dancers[1] ?? BLANK])
  const [errors, setErrors] = useState<{ first?: string; team?: string; year?: string }>({})
  const [dancerErrors, setDancerErrors] = useState<Array<Partial<Record<keyof DancerDetails, string>>>>([{}, {}])
  const [failure, setFailure] = useState<string | null>(null)

  const names = second.trim() ? [first, second] : [first]
  const setDancer = (i: number, patch: Partial<DancerDetails>) =>
    setDancers((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  function submit(event: FormEvent) {
    event.preventDefault()
    const paid = memberYear.trim() ? parseMonthYear(memberYear) : null
    const found = {
      first: first.trim() ? undefined : 'Enter the dancer’s name.',
      team: teamId ? undefined : 'Choose a team.',
      year: memberYear.trim() && !paid ? 'Enter a month and year, such as January 2026.' : undefined,
    }
    setErrors(found)
    // Every dancer needs a date of birth, a contact number, an email and an address
    const today = new Date().toISOString().slice(0, 10)
    const dancerFound = names.map((_, i) => {
      const d = dancers[i]!
      return {
        birthDate: !d.birthDate ? 'Enter the date of birth.' : d.birthDate > today ? 'The date of birth cannot be in the future.' : undefined,
        phone: d.phone.trim() ? undefined : 'Enter a contact number.',
        email: !d.email.trim() ? 'Enter an email.' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) ? undefined : 'Enter a valid email address.',
        address: d.address.trim() ? undefined : 'Enter the address.',
      }
    })
    setDancerErrors(dancerFound)
    const dancerBad = dancerFound.some((d) => d.birthDate || d.phone || d.email || d.address)
    if (found.first || found.team || found.year || dancerBad) return
    setFailure(null)
    const details: CompetitorDetails = {
      province,
      coachId: coachId || null,
      dancers: dancers.slice(0, names.length),
      beginner,
      memberYear: paid?.year ?? null,
      memberMonth: paid?.month ?? null,
    }
    const handlers = {
      onSuccess: (c: CompetitorRow) => {
        toast.success(`${competitor ? 'Saved' : 'Added'} ${c.names.join(' & ')}`)
        if (!competitor) onAdded?.()
        onDone()
      },
      onError: (e: Error) => setFailure(e.message),
    }
    if (competitor) update.mutate({ id: competitor.id, names, teamId, details }, handlers)
    else create.mutate({ names, teamId, details }, handlers)
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-9 pb-2">
        <section aria-label="Dancers" className="flex flex-col gap-3">
          <h3 className="font-mono text-xs uppercase text-neutral-500">Dancers</h3>
          <div className="flex flex-col gap-5">
            <Input label="Dancer" required value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} autoFocus />
            <Input label="Partner" value={second} onChange={(e) => setSecond(e.target.value)} />
          </div>
          <p className="text-small text-neutral-500">Leave the partner empty for a solo dancer.</p>
        </section>

        <section aria-label="Team and coach" className="flex flex-col gap-3">
          <h3 className="font-mono text-xs uppercase text-neutral-500">Team and coach</h3>
          <div className="flex flex-col gap-5">
            <Select label="Team" required value={teamId} onChange={(e) => setTeamId(e.target.value)} error={errors.team}>
              <option value="">Choose a team</option>
              {(teams.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
            <Select label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              <option value="">No coach</option>
              {(coaches.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Membership paid for"
              hint="For example: January 2026. Leave empty if not paid."
              value={memberYear}
              onChange={(e) => setMemberYear(e.target.value)}
              error={errors.year}
              className="font-mono tabular-nums"
            />
          </div>
          <p className="text-small text-neutral-500">Membership ends December 31 of the year it was paid in, whenever in the year that was.</p>
          <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
            <input type="checkbox" checked={beginner} onChange={(e) => setBeginner(e.target.checked)} className="size-5 accent-neutral-900" />
            Beginner (BGB): no regional or national experience
          </label>
        </section>

        {names.map((name, i) => (
          <fieldset key={i} className="flex flex-col gap-4 border-t border-neutral-200 pt-6">
            <legend className="float-left mb-4 font-mono text-xs uppercase text-neutral-500">Details: {name.trim() || `Dancer ${i + 1}`}</legend>
            <div className="flex w-full flex-col gap-5">
              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                <Input label="Date of birth" required type="date" value={dancers[i]!.birthDate} onChange={(e) => setDancer(i, { birthDate: e.target.value })} error={dancerErrors[i]?.birthDate} />
                <Input label="Contact no." required inputMode="tel" value={dancers[i]!.phone} onChange={(e) => setDancer(i, { phone: e.target.value })} error={dancerErrors[i]?.phone} />
              </div>
              <Select label="Gender" hint="Used for the Solo Junior Female entry in the Bicol Athletes list." value={dancers[i]!.gender ?? ''} onChange={(e) => setDancer(i, { gender: e.target.value as Gender | '' })}>
                <option value="">Not stated</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
              <Input label="Email" required type="email" value={dancers[i]!.email} onChange={(e) => setDancer(i, { email: e.target.value })} error={dancerErrors[i]?.email} />
              <Input label="Address" required value={dancers[i]!.address} onChange={(e) => setDancer(i, { address: e.target.value })} error={dancerErrors[i]?.address} />
            </div>
          </fieldset>
        ))}
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds a competitor, or edits the one given
export function CompetitorDialog({
  open,
  competitor,
  onClose,
  onAdded,
}: {
  open: boolean
  competitor: CompetitorRow | null
  onClose: () => void
  onAdded?: () => void
}) {
  const editing = competitor !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit competitor' : 'Add competitor'}
      description={editing ? 'Correct the entry form details.' : 'From the entry form. Back numbers are assigned afterwards.'}
      className="max-w-2xl"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add competitor'}
          </Button>
        </>
      }
    >
      {open && <CompetitorForm key={competitor?.id ?? 'new'} competitor={competitor} onDone={onClose} onAdded={onAdded} />}
    </Dialog>
  )
}
