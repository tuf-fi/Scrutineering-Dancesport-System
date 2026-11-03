import type { AthletePage as AthleteData } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Input, Select, toast } from '../../components/ui/index.ts'
import { useTeams, useCoaches, useSaveMyAthlete } from '../../hooks/index.ts'
import { AccountSection } from './AccountSection.tsx'
import { PhotoField } from './PhotoField.tsx'

export function EditAccount({ page }: { page: AthleteData }) {
  const { profile } = page
  const teams = useTeams()
  const coaches = useCoaches()
  const save = useSaveMyAthlete()
  const [name, setName] = useState(profile.name)
  const [birthDate, setBirthDate] = useState(profile.birthDate)
  const [phone, setPhone] = useState(profile.phone)
  const [province, setProvince] = useState(profile.province)
  const [address, setAddress] = useState(profile.address)
  const [teamId, setTeamId] = useState(profile.teamId ?? '')
  const [coachId, setCoachId] = useState(profile.coachId ?? '')
  const [error, setError] = useState<string | undefined>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter your name.')
    setError(undefined)
    save.mutate(
      { name, birthDate, phone, province, address, teamId: teamId || null, coachId: coachId || null },
      {
        onSuccess: (saved) =>
          toast.success(saved.changeRequest && !saved.changeRequest.rejectedReason ? 'Saved. Your team or coach change is waiting for the secretariat.' : 'Saved'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <AccountSection title="Edit account" note="Only the secretariat sees these. They use them for your entry form.">
      <PhotoField profile={profile} />
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <Input label="Email" value={profile.email} disabled readOnly />
        <Input label="Date of birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">No team yet</option>
          {(teams.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">No coach</option>
          {(coaches.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <p className="text-small text-neutral-600 sm:col-span-2">
          {profile.changeRequest && !profile.changeRequest.rejectedReason
            ? 'A change of team or coach is waiting for the secretariat. Until they approve it, your current team and coach stay.'
            : profile.teamId || profile.coachId
              ? 'Changing your team or coach is sent to the secretariat to approve.'
              : 'Choose your team and coach. After that, changes are sent to the secretariat to approve.'}
        </p>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </AccountSection>
  )
}
