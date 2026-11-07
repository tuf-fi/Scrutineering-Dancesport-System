import type { DeleteImpactItem, DeleteKind } from '@bis/shared'
import { useDeleteImpact } from '../hooks/index.ts'
import { Button, Dialog, ErrorState, SkeletonList, toast } from './ui/index.ts'

interface Remove {
  mutate: (vars: { id: string; cascade?: boolean }, options: { onSuccess: () => void; onError: (e: Error) => void }) => void
  isPending: boolean
}

// Every record that goes, one line each, under the name of what it is
function Group({ title, items }: { title: string; items: DeleteImpactItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="font-mono text-xs uppercase text-neutral-500">{title}</h3>
      <ul className="border-y border-neutral-200">
        {items.map((i) => (
          <li key={i.label} className="flex flex-col gap-1 border-t border-neutral-200 py-3 first:border-t-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-small font-medium text-neutral-900">{i.label}</span>
              <span className="font-mono text-small tabular-nums text-neutral-900">{i.count}</span>
            </div>
            {i.lines.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {i.lines.map((line, n) => (
                  <li key={n} className="whitespace-pre-wrap text-xs text-neutral-600">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// One confirmation for every delete: when the record has related data it lists exactly what goes with it
export function DeleteDialog({ kind, target, remove, onClose }: { kind: DeleteKind; target: { id: string; label: string } | null; remove: Remove; onClose: () => void }) {
  const impact = useDeleteImpact(kind, target?.id)
  const items = impact.data?.items ?? []
  const deleted = items.filter((i) => i.effect === 'delete')
  const kept = items.filter((i) => i.effect === 'change')
  const blocked = impact.data?.blocked ?? null
  const related = items.length > 0

  function confirm() {
    if (!target) return
    remove.mutate(
      { id: target.id, cascade: related },
      {
        onSuccess: () => {
          toast.success(`Deleted ${target.label}`)
          onClose()
        },
        onError: (e) => {
          onClose()
          toast.error(e.message)
        },
      },
    )
  }

  const description = blocked ?? (deleted.length > 0 ? "This also deletes the records listed below. This can't be undone." : related ? 'Nobody and nothing else is deleted. This can\'t be undone.' : "This can't be undone.")

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={`Delete ${target?.label ?? ''}?`}
      description={description}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {blocked ? 'Close' : 'Cancel'}
          </Button>
          {!blocked && (
            <Button variant="danger" disabled={remove.isPending || !impact.isSuccess} onClick={confirm}>
              {remove.isPending ? 'Deleting…' : deleted.length > 0 ? 'Delete everything' : 'Delete'}
            </Button>
          )}
        </>
      }
    >
      {impact.isLoading && <SkeletonList rows={3} />}
      {impact.isError && <ErrorState title="Couldn't check what is connected" onRetry={() => void impact.refetch()} />}
      {impact.isSuccess && related && (
        <div className="flex flex-col gap-5">
          <Group title="Will be deleted" items={deleted} />
          <Group title="Stays, only taken off" items={kept} />
        </div>
      )}
    </Dialog>
  )
}
