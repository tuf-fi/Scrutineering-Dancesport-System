import type { AthleteRow } from '@bis/shared'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Table, Textarea, Toolbar, toast } from '../../components/ui/index.ts'
import { useApproveProfileChange, useAthletes, useRejectProfileChange } from '../../hooks/index.ts'

const isWaiting = (a: AthleteRow) => a.changeRequest !== null && !a.changeRequest.rejectedReason

function Pair({ team, coach }: { team: string; coach: string }) {
  return (
    <span className="flex flex-col">
      <span>{team || 'No team'}</span>
      <span className="text-small text-neutral-600">{coach || 'No coach'}</span>
    </span>
  )
}

// Athletes asking to change their team or coach
export function ProfileChangesPage() {
  const athletes = useAthletes()
  const approve = useApproveProfileChange()
  const reject = useRejectProfileChange()
  const [query, setQuery] = useState('')
  const [rejecting, setRejecting] = useState<AthleteRow | null>(null)
  const [reason, setReason] = useState('')

  if (athletes.isError) return <ErrorState onRetry={() => void athletes.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (athletes.data ?? []).filter(
    (a) => isWaiting(a) && (!needle || [a.name, a.email, a.teamName, a.requestedTeamName, a.requestedCoachName].some((v) => v.toLowerCase().includes(needle))),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team and coach changes" description="Athletes asking to change their team or coach. Until you approve it, their current team and coach stay." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search changes" value={query} onChange={setQuery} />
      </Toolbar>

      <Table<AthleteRow>
        loading={athletes.isLoading}
        rows={rows}
        rowKey={(a) => a.id}
        minWidthClass="min-w-0"
        paginationLabel="Team and coach changes pagination"
        empty={needle ? { title: 'No changes match', description: 'Try a different name.' } : { title: 'Nothing waiting', description: 'Requests appear here when an athlete asks to change their team or coach.' }}
        columns={[
          { key: 'name', header: 'Athlete', cell: (a) => <span className="font-medium">{a.name}</span> },
          { key: 'email', header: 'Email', muted: true, hideBelow: 'lg', cell: (a) => a.email },
          { key: 'now', header: 'Now', hideBelow: 'sm', cell: (a) => <Pair team={a.teamName} coach={a.coachName} /> },
          { key: 'wants', header: 'Wants', cell: (a) => <Pair team={a.requestedTeamName} coach={a.requestedCoachName} /> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (a) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={Check}
                  label={`Approve change of team or coach of ${a.name}`}
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(a.id, { onSuccess: () => toast.success(`Approved the change for ${a.name}`), onError: (e) => toast.error(e.message) })}
                />
                <IconButton icon={X} tone="danger" label={`Turn down change of team or coach of ${a.name}`} onClick={() => setRejecting(a)} />
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Turn down the change for ${rejecting?.name ?? ''}?`}
        description="The athlete sees the reason and keeps their current team and coach."
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
                      toast.success(`Turned down the change for ${rejecting.name}`)
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
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </div>
  )
}
