import type { DeleteImpactItem, DeleteKind } from '@bis/shared'
import { useDeleteImpact } from '../hooks/index.ts'
import { Button, Dialog, ErrorState, SkeletonList, toast } from './ui/index.ts'

interface Remove {
  mutate: (vars: { id: string; cascade?: boolean }, options: { onSuccess: () => void; onError: (e: Error) => void }) => void
  isPending: boolean
}

function Group({ title, items }: { title: string; items: DeleteImpactItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="font-mono text-xs uppercase text-neutral-500">{title}</h3>
      <ul className="border-y border-neutral-200">
        {items.map((i) => (
          <li key={i.label} className="flex items-baseline justify-between gap-4 border-t border-neutral-200 py-2 first:border-t-0">
            <span className="min-w-0 text-small text-neutral-900">
              {i.label}
              {i.examples.length > 0 && <span className="block truncate text-xs text-neutral-500">{i.examples.join(', ')}</span>}
            </span>
            <span className="font-mono text-small tabular-nums text-neutral-900">{i.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// One confirmation for every delete: when the record has related data it says so and lists what goes with it
export function DeleteDialog({ kind, target, remove, onClose }: { kind: DeleteKind; target: { id: string; label: string } | null; remove: Remove; onClose: () => void }) {
  const impact = useDeleteImpact(kind, target?.id)
  const items = impact.data?.items ?? []
  const deleted = items.filter((i) => i.effect === 'delete')
  const changed = items.filter((i) => i.effect === 'change')
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

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={`Delete ${target?.label ?? ''}?`}
      description={related ? "This also deletes the data connected to it, listed below. This can't be undone." : "This can't be undone."}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={remove.isPending || !impact.isSuccess} onClick={confirm}>
            {remove.isPending ? 'Deleting…' : related ? 'Delete everything' : 'Delete'}
          </Button>
        </>
      }
    >
      {impact.isLoading && <SkeletonList rows={3} />}
      {impact.isError && <ErrorState title="Couldn't check what is connected" onRetry={() => void impact.refetch()} />}
      {impact.isSuccess && related && (
        <div className="flex flex-col gap-4">
          <Group title="Will be deleted" items={deleted} />
          <Group title="Will be changed" items={changed} />
        </div>
      )}
    </Dialog>
  )
}
