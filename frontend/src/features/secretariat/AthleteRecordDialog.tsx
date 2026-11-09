import { monthYearText, parseMonthYear, type AthleteRecord } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useCoaches, useSaveAthleteRecord, useTeams } from '../../hooks/index.ts'

const FORM_ID = 'athlete-record-form'

function AthleteRecordForm({ athlete, onDone }: { athlete: AthleteRecord | null; onDone: () => void }) {
  const start = athlete
  const save = useSaveAthleteRecord()
  const teams = useTeams()
  const coaches = useCoaches()
  const [name, setName] = useState(start?.name ?? '')
  const [birthDate, setBirthDate] = useState(start?.birthDate ?? '')
  const [phone, setPhone] = useState(start?.phone ?? '')
  const [province, setProvince] = useState(start?.province ?? '')
  const [address, setAddress] = useState(start?.address ?? '')
  const [teamId, setTeamId] = useState(start?.teamId ?? '')
  const [coachId, setCoachId] = useState(start?.coachId ?? '')
  const [memberYear, setMemberYear] = useState(monthYearText(start?.memberMonth, start?.memberYear))
  const [errors, setErrors] = useState<{ name?: string; year?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = {
      name: name.trim() ? undefined : 'Enter the athlete’s name.',
      year: memberYear.trim() && !parseMonthYear(memberYear) ? 'Enter a month and year, such as January 2026.' : undefined,
    }
    setErrors(found)
    const paid = memberYear.trim() ? parseMonthYear(memberYear) : null
    if (found.name || found.year) return
    setFailure(null)
    save.mutate(
      {
        id: athlete?.id,
        input: { name, birthDate, phone, province, address, teamId: teamId || null, coachId: coachId || null, memberYear: paid?.year ?? null, memberMonth: paid?.month ?? null },
      },
      {
        onSuccess: (a) => {
          toast.success(`${athlete ? 'Saved' : 'Added'} ${a.name}`)
          onDone()
        },
        onError: (err) => setFailure(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        </div>
        <Input label="Date of birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
        <Input
          label="Membership paid for"
          hint="For example: January 2026. It ends December 31. Leave empty if not paid."
          value={memberYear}
          onChange={(e) => setMemberYear(e.target.value)}
          error={errors.year}
          className="font-mono tabular-nums"
        />
        <div className="sm:col-span-2">
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">No team</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Select label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">No coach</option>
            {(coaches.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds an athlete who has no account yet, or edits the one given. They link their account to it once they sign in.
export function AthleteRecordDialog({ open, athlete, onClose }: { open: boolean; athlete: AthleteRecord | null; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={athlete ? 'Edit athlete' : 'Add athlete'}
      description="The athlete asks to link their account to this once they sign in."
      className="max-w-lg"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {athlete ? 'Save changes' : 'Add athlete'}
          </Button>
        </>
      }
    >
      {open && <AthleteRecordForm key={athlete?.id ?? 'new'} athlete={athlete} onDone={onClose} />}
    </Dialog>
  )
}
