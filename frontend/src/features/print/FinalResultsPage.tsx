import { Role, RoundType } from '@bis/shared'
import { useState } from 'react'
import { useParams } from 'react-router'
import { EmptyState } from '../../components/ui/index.ts'
import { useCompetitorRows, useResults, useRounds, useSkatingTable } from '../../hooks/index.ts'
import { competitorName, ordinal, placeRange, sheetDate, todayIso } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { PrintSheet } from './PrintSheet.tsx'
import { SIGNERS, SignOff, type SignerKey, type Signer, type Signers } from './SignOff.tsx'
import { PrintState } from './PrintState.tsx'
import { num, td, th } from './tableStyles.ts'
import { usePrintContext } from './usePrintContext.ts'

function SignLine({ role, signer, date }: { role: string; signer: Signer; date: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-12 items-end border-b border-neutral-900">
        {signer.signature && <img src={signer.signature} alt={`Signature of the ${role}`} className="max-h-12" />}
      </div>
      <p className="font-semibold">{role}</p>
      <p className="text-[9pt]">Name and signature{signer.name.trim() && `: ${signer.name.trim()}`}</p>
      <div className="mt-3 flex h-6 items-end border-b border-neutral-900">{date}</div>
      <p className="text-[9pt]">Date</p>
    </div>
  )
}

// The final placings; the scrutineer and the chairperson sign on screen first, and the date is today's
export function FinalResultsPage() {
  const { eventId = '' } = useParams()
  const user = useAuth((s) => s.user)
  const [signers, setSigners] = useState<Signers>({
    scrutineer: { name: user?.role === Role.Scrutineer ? user.name : '', signature: null },
    chairperson: { name: user?.role === Role.Chairperson ? user.name : '', signature: null },
  })
  const signed = (key: SignerKey, next: Signer) => setSigners((s) => ({ ...s, [key]: next }))
  const date = sheetDate(todayIso())
  const ctx = usePrintContext(eventId)
  const rounds = useRounds(eventId)
  const final = rounds.data?.find((r) => r.type === RoundType.Final)
  const results = useResults(eventId)
  const finalTable = useSkatingTable(final?.id ?? '')
  const people = useCompetitorRows()

  return (
    <PrintState ctx={ctx} failed={results.isError || finalTable.isError || people.isError} onRetry={() => void Promise.all([results.refetch(), finalTable.refetch(), people.refetch()])}>
      {({ event, competition, adjudicators }) => {
        const finalists = new Set((finalTable.data?.rows ?? []).map((r) => r.competitorId))
        const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
        const rows = (results.data ?? [])
          .filter((r) => finalists.has(r.competitorId))
          .sort((a, b) => a.place - b.place)
        if (rows.length === 0) {
          return <EmptyState title="No final results yet" description="They appear here once the scrutineer has approved the final." />
        }
        return (
          <>
          <SignOff signers={signers} onChange={signed} />
          <PrintSheet
            title="Final results"
            event={event}
            competition={competition}
            adjudicators={adjudicators}
            footer={`${rows.length} ${event.isSolo ? 'Solos' : 'Couples'} in the final.`}
          >
            <div className="flex flex-col gap-10">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-20`}>Place</th>
                    <th className={`${th} w-16`}>No.</th>
                    <th className={th}>{event.isSolo ? 'Solo' : 'Couple'}</th>
                    <th className={th}>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = byId.get(r.competitorId)
                    return (
                      <tr key={r.id}>
                        <td className={`${td} font-bold`}>
                          {placeRange(r) ?? ordinal(r.place)}
                        </td>
                        <td className={`${td} ${num}`}>{c?.backNumber}</td>
                        <td className={td}>{c ? competitorName(c.names) : ''}</td>
                        <td className={td}>{c?.teamName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-12 break-inside-avoid">
                {SIGNERS.map(({ key, role }) => (
                  <SignLine key={key} role={role} signer={signers[key]} date={date} />
                ))}
              </div>
            </div>
          </PrintSheet>
          </>
        )
      }}
    </PrintState>
  )
}
