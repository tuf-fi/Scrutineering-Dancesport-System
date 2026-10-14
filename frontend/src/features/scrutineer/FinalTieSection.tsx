import type { FinalTie } from '@bis/shared'
import { useState } from 'react'
import { Button, Select, toast } from '../../components/ui/index.ts'
import { useConfirmFinalTie, useProposeFinalTie, useStaffUsers } from '../../hooks/index.ts'
import { competitorName, ordinal } from '../../lib/format.ts'

type Mode = 'keep' | 'order'

// A tie in a final that the Skating System leaves shared. The scrutineer says how it is settled, the chairperson confirms.
export function FinalTieSection({ tie, readOnly, isChairperson }: { tie: FinalTie; readOnly: boolean; isChairperson: boolean }) {
  const propose = useProposeFinalTie()
  const confirm = useConfirmFinalTie()
  const staff = useStaffUsers()
  const people = tie.groups.flatMap((g) => g.competitors)
  const [mode, setMode] = useState<Mode>(tie.decision?.mode ?? 'keep')
  // Each tied competitor's place in the tie-break, as typed from the sheet
  const [order, setOrder] = useState<Record<string, string>>(() =>
    Object.fromEntries((tie.decision?.order ?? []).map((id, i) => [id, String(i + 1)])),
  )
  const decision = tie.decision
  const name = (id: string) => staff.data?.find((s) => s.id === id)?.name ?? 'the chairperson'

  const picked = people.map((p) => order[p.competitorId])
  const orderValid = picked.every(Boolean) && new Set(picked).size === people.length

  const status = decision?.confirmedBy
    ? `Confirmed by ${name(decision.confirmedBy)}.`
    : decision
      ? 'Proposed. Waiting for the chairperson to confirm.'
      : isChairperson
        ? 'The scrutineer has not proposed a decision yet.'
        : null
  const choosing = !readOnly && !decision?.confirmedBy

  function submit() {
    const sorted = people.map((p) => p.competitorId).sort((a, b) => Number(order[a]) - Number(order[b]))
    propose.mutate(
      { roundId: tie.roundId, mode, order: mode === 'order' ? sorted : [] },
      { onSuccess: () => toast.success('Decision proposed'), onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <section
      aria-label="Tie in the final"
      className="grid gap-x-16 gap-y-6 border-y border-neutral-200 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-title font-semibold text-neutral-900">Tie in the final</h2>
        {tie.groups.map((g) => (
          <p key={g.place} className="text-small text-neutral-600">
            {g.competitors.map((c) => `No. ${c.backNumber ?? '–'}`).join(', ')} share {ordinal(g.place)} place. The marks cannot separate them.
          </p>
        ))}
        {status && <p className="text-small text-neutral-900">{status}</p>}
      </div>

      <div className="flex flex-col gap-5">
        {choosing ? (
          <>
            <div role="radiogroup" aria-label="Tie decision" className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
                <input type="radio" name="final-tie" checked={mode === 'keep'} onChange={() => setMode('keep')} className="size-5 accent-neutral-900" />
                Keep the shared place
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
                <input type="radio" name="final-tie" checked={mode === 'order'} onChange={() => setMode('order')} className="size-5 accent-neutral-900" />
                Settle it with a tie-break
              </label>
            </div>
            {mode === 'order' && (
              <div className="grid max-w-sm gap-3">
                {people.map((p) => (
                  <Select
                    key={p.competitorId}
                    label={`Tie-break place of No. ${p.backNumber ?? '–'} ${competitorName(p.names)}`}
                    value={order[p.competitorId] ?? ''}
                    onChange={(e) => setOrder((o) => ({ ...o, [p.competitorId]: e.target.value }))}
                  >
                    <option value="">Choose</option>
                    {people.map((_, i) => (
                      <option key={i} value={String(i + 1)}>
                        {ordinal(i + 1)} in the tie-break
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            )}
          </>
        ) : (
          decision && (
            <p className="text-small text-neutral-600">
              {decision.mode === 'keep'
                ? 'The place stays shared.'
                : `Settled by a tie-break: ${decision.order
                    .map((id) => `No. ${people.find((p) => p.competitorId === id)?.backNumber ?? '–'}`)
                    .join(', then ')}.`}
            </p>
          )
        )}
        <div className="flex flex-wrap gap-3">
          {choosing && (
            <Button disabled={propose.isPending || (mode === 'order' && !orderValid)} onClick={submit}>
              Propose decision
            </Button>
          )}
          {isChairperson && decision && !decision.confirmedBy && (
            <Button
              disabled={confirm.isPending}
              onClick={() => confirm.mutate(tie.roundId, { onSuccess: () => toast.success('Tie decision confirmed'), onError: (e) => toast.error(e.message) })}
            >
              Confirm tie decision
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
