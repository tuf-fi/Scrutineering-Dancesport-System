import type { AthleteProfile } from '@bis/shared'
import { useState } from 'react'
import { Button, Select, toast } from '../../components/ui/index.ts'
import { useAthleteRecords, useCancelAthleteClaim, useClaimAthleteRecord } from '../../hooks/index.ts'
import { AccountSection } from './AccountSection.tsx'

// An athlete the secretariat already added can link their account to it; nothing shows when there is none to link
export function LinkAthleteRecord({ profile }: { profile: AthleteProfile }) {
  const records = useAthleteRecords()
  const claim = useClaimAthleteRecord()
  const cancel = useCancelAthleteClaim()
  const [target, setTarget] = useState('')

  if (profile.claim) {
    return (
      <AccountSection title="Waiting for the secretariat" note={`You asked to be linked to ${profile.claim.name}. Your details fill in as soon as they confirm it.`}>
        <Button variant="secondary" size="sm" className="w-fit" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined)}>
          Cancel the request
        </Button>
      </AccountSection>
    )
  }

  const options = records.data ?? []
  if (options.length === 0) return null

  return (
    <AccountSection title="Link your athlete record" note="The secretariat may have added you already. Choose your name and they confirm it, then your team and membership appear here.">
      <div className="flex max-w-md flex-col gap-5">
        <Select label="Athlete" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose your name</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button className="w-fit" disabled={!target || claim.isPending} onClick={() => claim.mutate(target, { onError: (e) => toast.error(e.message) })}>
          Send request
        </Button>
      </div>
    </AccountSection>
  )
}
