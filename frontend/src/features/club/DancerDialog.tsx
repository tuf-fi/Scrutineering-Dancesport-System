import { ageGroupForBirthYears, type AgeGroup, type ClubDancer } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useCompetitions, useSaveDancer } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL } from '../../lib/format.ts'

const thisYear = () => new Date().getFullYear()
const yearOf = (text: string) => (/^\d{4}$/.test(text.trim()) ? Number(text) : Number.NaN)

const FORM_ID = 'dancer-form'

function DancerForm({ dancer, onDone }: { dancer: ClubDancer | null; onDone: () => void }) {
  const save = useSaveDancer()
  const [first, setFirst] = useState(dancer?.names[0] ?? '')
  const [second, setSecond] = useState(dancer?.names[1] ?? '')
  // Birth years are used here to work out the age group and are never sent or kept
  const [firstYear, setFirstYear] = useState('')
  const [secondYear, setSecondYear] = useState('')
  const [errors, setErrors] = useState<{ first?: string; year?: string; second?: string }>({})
  const competitions = useCompetitions()
  const upcoming = (competitions.data ?? []).filter((c) => c.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0]
  const year = upcoming ? Number(upcoming.date.slice(0, 4)) : thisYear()

  const years = [firstYear, ...(second.trim() ? [secondYear] : [])].map(yearOf)
  const worked = years.some((y) => Number.isNaN(y)) ? null : ageGroupForBirthYears(years, year)
  // Editing without typing a year keeps the age group the dancer has
  const ageGroup: AgeGroup | null = worked ?? (dancer && !firstYear && !secondYear ? dancer.ageGroup : null)
  const [failure, setFailure] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const found = {
      first: first.trim() ? undefined : 'Enter the dancer’s name.',
      year: dancer && !firstYear && !secondYear ? undefined : Number.isNaN(yearOf(firstYear)) || ageGroupForBirthYears([yearOf(firstYear)], year) === null ? 'Enter the four-digit year of birth.' : undefined,
      second: !second.trim() || (dancer && !firstYear && !secondYear) || (!Number.isNaN(yearOf(secondYear)) && ageGroupForBirthYears([yearOf(secondYear)], year) !== null) ? undefined : 'Enter the partner’s four-digit year of birth.',
    }
    setErrors(found)
    if (found.first || found.year || found.second || !ageGroup) return
    setFailure(null)
    save.mutate(
      { names: [first, second], ageGroup, id: dancer?.id },
      {
        onSuccess: () => {
          toast.success(dancer ? 'Dancer updated' : 'Dancer added')
          onDone()
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Input label="Dancer" value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} autoFocus />
        <Input label="Partner" hint="Leave empty for a solo dancer." value={second} onChange={(e) => setSecond(e.target.value)} />
        <Input label="Year of birth" inputMode="numeric" placeholder="2012" value={firstYear} onChange={(e) => setFirstYear(e.target.value)} error={errors.year} />
        {second.trim() && (
          <Input label="Partner’s year of birth" inputMode="numeric" placeholder="2011" value={secondYear} onChange={(e) => setSecondYear(e.target.value)} error={errors.second} />
        )}
        <p className="text-small text-neutral-700">
          Age group: <span className="font-semibold text-neutral-900">{ageGroup ? AGE_GROUP_LABEL[ageGroup] : 'enter the year of birth'}</span>
          {ageGroup && worked ? ` for ${year}` : ''}
        </p>
        <p className="text-small text-neutral-600">The year is used only to work out the age group. It is not saved.</p>
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds a dancer or edits the one given. Only a name and an age group are kept (Data Privacy Act).
export function DancerDialog({ open, dancer, onClose }: { open: boolean; dancer: ClubDancer | null; onClose: () => void }) {
  const editing = dancer !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit dancer' : 'Add dancer'}
      description="Only a name and an age group are kept. A couple dances in the older partner’s age group."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add dancer'}
          </Button>
        </>
      }
    >
      {open && <DancerForm key={dancer?.id ?? 'new'} dancer={dancer} onDone={onClose} />}
    </Dialog>
  )
}
