import type { AthletePage as AthleteData } from '@bis/shared'
import { ButtonLink } from '../../components/ui/index.ts'
import { useTeams, useCoaches } from '../../hooks/index.ts'
import { formatDate } from '../../lib/format.ts'
import { AccountSection } from './AccountSection.tsx'

// What the secretariat has on file, read-only; Edit account changes it
export function AccountInfo({ page }: { page: AthleteData }) {
  const { profile, year } = page
  const teams = useTeams()
  const coaches = useCoaches()

  const rows = [
    { label: 'Full name', value: profile.name },
    { label: 'Email', value: profile.email },
    { label: 'Date of birth', value: profile.birthDate ? formatDate(profile.birthDate) : undefined },
    { label: 'Contact no.', value: profile.phone },
    { label: 'Province', value: profile.province },
    { label: 'Address', value: profile.address },
    { label: 'Team', value: teams.data?.find((c) => c.id === profile.teamId)?.name },
    { label: 'Coach', value: coaches.data?.find((c) => c.id === profile.coachId)?.name },
    { label: 'Member until', value: profile.memberYear === year ? `December ${year}` : undefined },
  ]
  const missing = rows.some((r) => !r.value && r.label !== 'Member until' && r.label !== 'Coach')

  return (
    <AccountSection title="Account information" note="Only the secretariat sees these. They use them for your entry form.">
      <dl className="divide-y divide-neutral-200 border-y border-neutral-200">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[8.5rem_1fr] gap-x-6 py-3.5 text-small sm:grid-cols-[11rem_1fr]">
            <dt className="text-neutral-600">{r.label}</dt>
            <dd className={r.value ? 'font-medium text-neutral-900' : 'text-neutral-400'}>{r.value || 'Not set'}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <ButtonLink to="/athlete/edit">Edit account</ButtonLink>
        {profile.memberYear !== year && (
          <ButtonLink to="/athlete/membership" variant="secondary">
            Pay {year} membership
          </ButtonLink>
        )}
      </div>
      {missing && <p className="text-small text-neutral-600">Some details are empty. Fill them in before you enter a competition.</p>}
    </AccountSection>
  )
}
