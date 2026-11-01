import type { AthleteRow } from '@bis/shared'
import { Check, KeyRound, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Select, Table, Textarea, Toolbar, toast } from '../../components/ui/index.ts'
import { useAthletes, useConfirmMembership, useDeleteAthlete, useRejectMembership, useResetAthletePassword } from '../../hooks/index.ts'

type Filter = 'all' | 'waiting'

const isWaiting = (a: AthleteRow) => a.request !== null && !a.request.rejectedReason

function PaymentCell({ athlete }: { athlete: AthleteRow }) {
  const { request } = athlete
  if (!request) return <span className="text-neutral-500">–</span>
  return (
    <span className="flex flex-col gap-0.5">
      <Badge pill tone={request.rejectedReason ? 'danger' : 'gold'}>{request.rejectedReason ? 'Not confirmed' : 'Waiting'}</Badge>
      <span className="font-mono text-small text-neutral-600">
        {request.method} {request.reference}
      </span>
    </span>
  )
}

export function AthletesPage() {
  const athletes = useAthletes()
  const confirm = useConfirmMembership()
  const reject = useRejectMembership()
  const reset = useResetAthletePassword()
  const remove = useDeleteAthlete()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [rejecting, setRejecting] = useState<AthleteRow | null>(null)
  const [reason, setReason] = useState('')
  const [toReset, setToReset] = useState<AthleteRow | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AthleteRow | null>(null)

  if (athletes.isError) return <ErrorState onRetry={() => void athletes.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (athletes.data ?? []).filter(
    (a) => (filter === 'all' || isWaiting(a)) && (!needle || [a.name, a.email, a.clubName].some((v) => v.toLowerCase().includes(needle))),
  )

  function closeReset() {
    setToReset(null)
    setTempPassword(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Athletes" description="Athletes with an account. Confirm a membership once the money has arrived." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search athletes" value={query} onChange={setQuery} />
        <Select label="Show" hideLabel className="w-full sm:w-52" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All athletes</option>
          <option value="waiting">Payment waiting</option>
        </Select>
      </Toolbar>

      <Table<AthleteRow>
        loading={athletes.isLoading}
        rows={rows}
        rowKey={(a) => a.id}
        minWidthClass="min-w-0"
        paginationLabel="Athletes pagination"
        detailTitle={(a) => a.name}
        empty={
          needle || filter === 'waiting'
            ? { title: 'No athletes match', description: 'Try a different name or filter.' }
            : { title: 'No athlete accounts yet', description: 'Athletes make their own account on the athlete sign-in page.' }
        }
        columns={[
          { key: 'name', header: 'Athlete', cell: (a) => <span className="font-medium">{a.name}</span> },
          { key: 'email', header: 'Email', cell: (a) => a.email, muted: true, hideBelow: 'md' },
          { key: 'club', header: 'Club', cell: (a) => a.clubName || '–', muted: true, hideBelow: 'md' },
          { key: 'member', header: 'Membership', cell: (a) => a.memberYear ?? 'Not paid', mono: true, muted: true, hideBelow: 'sm' },
          { key: 'payment', header: 'Payment', cell: (a) => <PaymentCell athlete={a} /> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-36',
            cell: (a) => (
              <div className="flex justify-end gap-0.5">
                {a.request && (
                  <>
                    {isWaiting(a) && (
                      <IconButton
                        icon={Check}
                        label={`Confirm membership of ${a.name}`}
                        disabled={confirm.isPending}
                        onClick={() =>
                          confirm.mutate(a.id, {
                            onSuccess: () => toast.success(`Confirmed ${a.name}`),
                            onError: (e) => toast.error(e.message),
                          })
                        }
                      />
                    )}
                    {isWaiting(a) && <IconButton icon={X} tone="danger" label={`Turn down payment of ${a.name}`} onClick={() => setRejecting(a)} />}
                  </>
                )}
                <IconButton icon={KeyRound} label={`Reset password of ${a.name}`} onClick={() => setToReset(a)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setToDelete(a)} />
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Turn down the payment of ${rejecting?.name ?? ''}?`}
        description="The athlete sees the reason and can send the payment again."
        actions={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reject.isPending || !reason.trim()}
              onClick={() =>
                rejecting &&
                reject.mutate(
                  { id: rejecting.id, reason },
                  {
                    onSuccess: () => {
                      toast.success(`Turned down the payment of ${rejecting.name}`)
                      setRejecting(null)
                      setReason('')
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {reject.isPending ? 'Saving…' : 'Turn down'}
            </Button>
          </>
        }
      >
        <Textarea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>

      <Dialog
        open={toReset !== null}
        onClose={closeReset}
        title={tempPassword ? 'New password' : `Reset the password of ${toReset?.name ?? ''}?`}
        description={tempPassword ? 'Give this to the athlete. It is shown once, and they are signed out everywhere.' : 'This signs them out everywhere and gives them a new password.'}
        actions={
          tempPassword ? (
            <Button onClick={closeReset}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeReset}>
                Cancel
              </Button>
              <Button
                disabled={reset.isPending}
                onClick={() =>
                  toReset &&
                  reset.mutate(toReset.id, {
                    onSuccess: (r) => setTempPassword(r.tempPassword),
                    onError: (e) => {
                      closeReset()
                      toast.error(e.message)
                    },
                  })
                }
              >
                {reset.isPending ? 'Resetting…' : 'Reset password'}
              </Button>
            </>
          )
        }
      >
        {tempPassword && <p className="font-mono text-title text-neutral-900">{tempPassword}</p>}
      </Dialog>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete the account of ${toDelete?.name ?? ''}?`}
        description="This can't be undone. Their entries and results are not affected."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                toDelete &&
                remove.mutate(toDelete.id, {
                  onSuccess: () => {
                    toast.success(`Deleted ${toDelete.name}`)
                    setToDelete(null)
                  },
                  onError: (e) => {
                    setToDelete(null)
                    toast.error(e.message)
                  },
                })
              }
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />
    </div>
  )
}
