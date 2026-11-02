import type { PointsRow } from '@bis/shared'
import { useState } from 'react'
import { Button, ErrorState, Input, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { usePointsTable, useSavePointsTable } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'

const GROUPS = [
  { title: 'Final placings', note: 'Awarded by the place in the final.', has: (r: PointsRow) => r.place !== null },
  { title: 'Earlier rounds', note: 'Awarded to competitors who went out in that round.', has: (r: PointsRow) => r.place === null },
]

function PointsEditor({ rows }: { rows: PointsRow[] }) {
  const original = rows.map((r) => String(r.points))
  const [values, setValues] = useState(original)
  const [failure, setFailure] = useState<string | null>(null)
  const save = useSavePointsTable()

  const invalid = (v: string) => !/^\d+$/.test(v.trim())
  const changed = values.filter((v, i) => v.trim() !== original[i]).length
  const dirty = changed > 0
  const hasError = values.some(invalid)
  // The longest bar is the most points anywhere, so the bars compare the rows with each other
  const top = Math.max(1, ...values.map((v) => (invalid(v) ? 0 : Number(v))))

  function onSave() {
    setFailure(null)
    save.mutate(
      rows.map((r, i) => ({ ...r, points: Number(values[i]) })),
      {
        onSuccess: () => toast.success('Points table saved'),
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {GROUPS.map((group) => {
        const members = rows.map((row, i) => ({ row, i })).filter(({ row }) => group.has(row))
        if (members.length === 0) return null
        return (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-xs uppercase text-neutral-500">{group.title}</h2>
              <p className="text-small text-neutral-600">{group.note}</p>
            </div>
            <ul className="border-y border-neutral-200">
              {members.map(({ row, i }) => {
                const edited = values[i]!.trim() !== original[i]
                const width = invalid(values[i]!) ? 0 : (Number(values[i]) / top) * 100
                return (
                  <li key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-5 border-t border-neutral-200 py-2.5 first:border-t-0">
                    <span className="flex items-center gap-2 text-small text-neutral-900">
                      {row.label}
                      {edited && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold-400" />}
                    </span>
                    <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full rounded-full bg-gold-400 transition-[width] duration-300 ease-out" style={{ width: `${width}%` }} />
                    </span>
                    <Input
                      label={`Points for ${row.label}`}
                      hideLabel
                      inputMode="numeric"
                      value={values[i]}
                      error={invalid(values[i]!) ? 'Whole number' : undefined}
                      onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                      className="h-9! bg-white px-2.5 text-right font-mono tabular-nums"
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <div className="flex items-center justify-between gap-3">
        <p role={failure ? 'alert' : undefined} className={cn('text-small', failure ? 'text-danger' : dirty ? 'font-medium text-neutral-900' : 'text-neutral-500')}>
          {failure ?? (dirty ? `${changed} unsaved ${changed === 1 ? 'change' : 'changes'}` : 'All changes saved')}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setValues(original)}>
            Discard
          </Button>
          <Button disabled={!dirty || hasError || save.isPending} onClick={onSave}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PointsPage() {
  const table = usePointsTable()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Points table" description="Ranking points awarded for each result." />
      {table.isError ? (
        <ErrorState onRetry={() => void table.refetch()} />
      ) : table.data ? (
        // Remount after a save so "unchanged" is measured against the saved values
        <PointsEditor key={table.data.map((r) => r.points).join('-')} rows={table.data} />
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
    </div>
  )
}
