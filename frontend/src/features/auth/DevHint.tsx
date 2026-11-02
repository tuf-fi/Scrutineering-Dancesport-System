import { usingMocks } from '../../api/mode.ts'
import { useSampleCredentials } from '../../hooks/index.ts'

// Sample app only: shows the sample sign-ins so the app can be walked through
export function DevHint({ kind }: { kind: 'staff' | 'athlete' | 'coach' | 'team' | 'pin' }) {
  const { data } = useSampleCredentials()
  if (!import.meta.env.DEV || !usingMocks || !data) return null

  const email = { athlete: data.athleteEmail, coach: data.coachEmail, team: data.teamEmail }
  const sample =
    kind === 'staff'
      ? `${data.usernames.join(', ')} · password ${data.password}`
      : kind === 'pin'
        ? data.pins.map((p) => `${p.letter} ${p.pin}`).join(' · ')
        : `${email[kind]} · password ${data.password}`

  return (
    <p className="border-t border-neutral-200 pt-3 text-neutral-600">
      Sample sign-in: <span className="font-mono">{sample}</span>. Press Ctrl+Shift+D to switch role.
    </p>
  )
}
