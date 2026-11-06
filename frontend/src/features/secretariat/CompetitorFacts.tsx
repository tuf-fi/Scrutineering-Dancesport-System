import { membershipLabel, type CompetitorRow } from '@bis/shared'
import type { ReactNode } from 'react'
import { useCoaches } from '../../hooks/index.ts'
import { formatDate } from '../../lib/format.ts'

function Facts({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 border-t border-neutral-200 pt-6 first:border-t-0 first:pt-0">
      <h3 className="font-mono text-xs uppercase text-neutral-500">{title}</h3>
      <dl className="flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 border-t border-neutral-100 py-2.5 text-small first:border-t-0">
            <dt className="text-neutral-500">{label}</dt>
            <dd className={value ? 'min-w-0 break-words font-medium text-neutral-900' : 'text-neutral-400'}>{value || 'Not set'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Everything the entry form says about a competitor: the team, then each dancer's own details
export function CompetitorFacts({ competitor }: { competitor: CompetitorRow }) {
  const coaches = useCoaches()
  const details = competitor.details

  if (!details) {
    return <Facts title="On file" rows={[['Entry form', null]]} />
  }
  return (
    <>
      <Facts
        title="Team"
        rows={[
          ['Province', details.province],
          ['Coach', coaches.data?.find((c) => c.id === details.coachId)?.name],
          ['Membership', details.memberYear ? membershipLabel(details.memberYear, new Date().getFullYear()) : null],
          ['Beginner (BGB)', details.beginner ? 'Yes' : 'No'],
        ]}
      />
      {competitor.names.map((name, i) => {
        const d = details.dancers[i]
        return (
          <Facts
            key={`${name}-${i}`}
            // A solo dancer's name is the panel's title already
            title={competitor.names.length > 1 ? name : 'Dancer'}
            rows={[
              ['Date of birth', d?.birthDate ? formatDate(d.birthDate) : null],
              ['Contact no.', d?.phone],
              ['Email', d?.email],
              ['Address', d?.address],
            ]}
          />
        )
      })}
    </>
  )
}
