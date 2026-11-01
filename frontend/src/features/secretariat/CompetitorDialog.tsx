import type { CompetitorDetails, CompetitorRow, DancerDetails } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useClubs, useCoaches, useCreateCompetitor, useUpdateCompetitor } from '../../hooks/index.ts'

const FORM_ID = 'competitor-form'

const BLANK: DancerDetails = { birthDate: '', address: '', email: '', phone: '' }

function CompetitorForm({ competitor, onDone }: { competitor: CompetitorRow | null; onDone: () => void }) {
  const clubs = useClubs()
  const coaches = useCoaches()
  const create = useCreateCompetitor()
  const update = useUpdateCompetitor()
  const saved = competitor?.details
  const [first, setFirst] = useState(competitor?.names[0] ?? '')
  const [second, setSecond] = useState(competitor?.names[1] ?? '')
  const [clubId, setClubId] = useState(competitor?.clubId ?? '')
  const [province, setProvince] = useState(saved?.province ?? '')
  const [coachId, setCoachId] = useState(saved?.coachId ?? '')
  const [beginner, setBeginner] = useState(saved?.beginner ?? false)
  const [memberYear, setMemberYear] = useState(saved?.memberYear ? String(saved.memberYear) : '')
  const [dancers, setDancers] = useState<DancerDetails[]>([saved?.dancers[0] ?? BLANK, saved?.dancers[1] ?? BLANK])
  const [errors, setErrors] = useState<{ first?: string; club?: string; year?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  const names = second.trim() ? [first, second] : [first]
  const setDancer = (i: number, patch: Partial<DancerDetails>) =>
    setDancers((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  function submit(event: FormEvent) {
    event.preventDefault()
    const year = memberYear.trim()
    const found = {
      first: first.trim() ? undefined : 'Enter the dancer’s name.',
      club: clubId ? undefined : 'Choose a club.',
      year: year && !/^\d{4}$/.test(year) ? 'Four digits, such as 2026.' : undefined,
    }
    setErrors(found)
    if (found.first || found.club || found.year) return
    setFailure(null)
    const details: CompetitorDetails = {
      province,
      coachId: coachId || null,
      dancers: dancers.slice(0, names.length),
      beginner,
      memberYear: year ? Number(year) : null,
    }
    const handlers = {
      onSuccess: (c: CompetitorRow) => {
        toast.success(`${competitor ? 'Saved' : 'Added'} ${c.names.join(' & ')}`)
        onDone()
      },
      onError: (e: Error) => setFailure(e.message),
    }
    if (competitor) update.mutate({ id: competitor.id, names, clubId, details }, handlers)
    else create.mutate({ names, clubId, details }, handlers)
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Dancer" value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} autoFocus />
        <Input
          label="Partner"
          hint="Leave empty for a solo dancer."
          value={second}
          onChange={(e) => setSecond(e.target.value)}
        />
        <Select label="Club" value={clubId} onChange={(e) => setClubId(e.target.value)} error={errors.club}>
          <option value="">Choose a club</option>
          {(clubs.data ?? []).map((c) => (
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
          hint="The year. Leave empty if not paid."
          inputMode="numeric"
          value={memberYear}
          onChange={(e) => setMemberYear(e.target.value)}
          error={errors.year}
          className="font-mono tabular-nums"
        />
        <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900 sm:col-span-2">
          <input type="checkbox" checked={beginner} onChange={(e) => setBeginner(e.target.checked)} className="size-5 accent-neutral-900" />
          Beginner (BGB): no regional or national experience
        </label>

        {names.map((name, i) => (
          <fieldset key={i} className="grid gap-4 border-t border-neutral-200 pt-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="text-small font-semibold text-neutral-900">{name.trim() || `Dancer ${i + 1}`}</legend>
            <Input label="Date of birth" type="date" value={dancers[i]!.birthDate} onChange={(e) => setDancer(i, { birthDate: e.target.value })} />
            <Input label="Contact no." inputMode="tel" value={dancers[i]!.phone} onChange={(e) => setDancer(i, { phone: e.target.value })} />
            <Input label="Email" type="email" value={dancers[i]!.email} onChange={(e) => setDancer(i, { email: e.target.value })} />
            <Input label="Address" value={dancers[i]!.address} onChange={(e) => setDancer(i, { address: e.target.value })} />
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
}: {
  open: boolean
  competitor: CompetitorRow | null
  onClose: () => void
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
      {open && <CompetitorForm key={competitor?.id ?? 'new'} competitor={competitor} onDone={onClose} />}
    </Dialog>
  )
}
