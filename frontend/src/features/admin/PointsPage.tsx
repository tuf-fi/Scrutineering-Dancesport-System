import type { PointsRow } from '@bis/shared'
import { useState } from 'react'
import { Button, ErrorState, Input, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { usePointsTable, useSavePointsTable } from '../../hooks/index.ts'

function PointsEditor({ rows }: { rows: PointsRow[] }) {
  const original = rows.map((r) => String(r.points))
  const [values, setValues] = useState(original)
  const [failure, setFailure] = useState<string | null>(null)
  const save = useSavePointsTable()

  const invalid = (v: string) => !/^\d+$/.test(v.trim())
  const dirty = values.some((v, i) => v.trim() !== original[i])
  const hasError = values.some(invalid)

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
    <div className="max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full border-collapse text-small">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-neutral-500">
              Result
            </th>
            <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-neutral-500">
              Points
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={row.label}>
              <th scope="row" className="px-5 py-2 text-left font-normal text-neutral-900">
                {row.label}
              </th>
              <td className="px-5 py-2">
                <div className="ml-auto w-20">
                  <Input
                    label={`Points for ${row.label}`}
                    hideLabel
                    inputMode="numeric"
                    value={values[i]}
                    error={invalid(values[i]) ? 'Whole number' : undefined}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    className="h-8! bg-white px-2.5 text-right font-mono tabular-nums"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-3.5">
        <p role={failure ? 'alert' : undefined} className={failure ? 'text-small text-danger' : 'text-small text-neutral-600'}>
          {failure ?? (dirty ? 'Unsaved changes' : 'All changes saved')}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setValues(original)}>
            Discard changes
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Points table"
        description="Ranking points awarded for each result."
      />
      {table.isError ? (
        <ErrorState onRetry={() => void table.refetch()} />
      ) : table.data ? (
        // Remount after a save so "unchanged" is measured against the saved values
        <PointsEditor key={table.data.map((r) => r.points).join('-')} rows={table.data} />
      ) : (
        <div className="flex max-w-xl flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      )}
    </div>
  )
}
