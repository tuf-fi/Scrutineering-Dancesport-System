import type { AthleteRow, MemberChangeRow } from '@bis/shared'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Table, Textarea, Toolbar, toast } from '../../components/ui/index.ts'
import { useApproveMemberChange, useApproveProfileChange, useAthletes, useMemberChanges, useRejectMemberChange, useRejectProfileChange } from '../../hooks/index.ts'

const isWaiting = (a: AthleteRow) => a.changeRequest !== null && !a.changeRequest.rejectedReason

function Pair({ first, second }: { first: string; second: string }) {
  return (
    <span className="flex flex-col">
      <span>{first}</span>
      <span className="text-small text-neutral-600">{second}</span>
    </span>
  )
}

// Athletes asking to change their name, birth date, team or coach
export function ProfileChangesPage() {
  const athletes = useAthletes()
  const approve = useApproveProfileChange()
  const reject = useRejectProfileChange()
  const coaches = useMemberChanges()
  const approveCoach = useApproveMemberChange()
  const rejectCoach = useRejectMemberChange()
  const [rejectingCoach, setRejectingCoach] = useState<MemberChangeRow | null>(null)
  const [query, setQuery] = useState('')
  const [rejecting, setRejecting] = useState<AthleteRow | null>(null)
  const [reason, setReason] = useState('')

  if (athletes.isError || coaches.isError) return <ErrorState onRetry={() => { void athletes.refetch(); void coaches.refetch() }} />

  const needle = query.trim().toLowerCase()
  const rows = (athletes.data ?? []).filter(
    (a) => isWaiting(a) && (!needle || [a.name, a.email, a.teamName, a.requestedName, a.requestedTeamName, a.requestedCoachName].some((v) => v.toLowerCase().includes(needle))),
  )

  const coachRows = (coaches.data ?? []).filter((c) => !needle || [c.name, c.requestedName].some((v) => v.toLowerCase().includes(needle)))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile changes" description="Athletes and coaches asking to change their name, date of birth, team or coach. Until you approve it, their current details stay." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search changes" value={query} onChange={setQuery} />
      </Toolbar>

      <Table<AthleteRow>
        loading={athletes.isLoading}
        rows={rows}
        rowKey={(a) => a.id}
        minWidthClass="min-w-0"
        paginationLabel="Profile changes pagination"
        empty={needle ? { title: 'No changes match', description: 'Try a different name.' } : { title: 'Nothing waiting', description: 'Requests appear here when an athlete asks to change their name, date of birth, team or coach.' }}
        columns={[
          { key: 'name', header: 'Athlete', cell: (a) => <span className="font-medium">{a.name}</span> },
          { key: 'email', header: 'Email', muted: true, hideBelow: 'lg', cell: (a) => a.email },
          { key: 'now', header: 'Now', hideBelow: 'sm', cell: (a) => <Pair first={a.name} second={[a.birthDate, a.teamName || 'No team', a.coachName || 'No coach'].filter(Boolean).join(' / ')} /> },
          {
            key: 'wants',
            header: 'Wants',
            cell: (a) => (
              <Pair
                first={a.requestedName || a.name}
                second={[a.requestedBirthDate || a.birthDate, a.requestedTeamName || 'No team', a.requestedCoachName || 'No coach'].filter(Boolean).join(' / ')}
              />
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (a) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={Check}
                  label={`Approve change for ${a.name}`}
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(a.id, { onSuccess: () => toast.success(`Approved the change for ${a.name}`), onError: (e) => toast.error(e.message) })}
                />
                <IconButton icon={X} tone="danger" label={`Turn down change for ${a.name}`} onClick={() => setRejecting(a)} />
              </div>
            ),
          },
        ]}
      />

      <Table<MemberChangeRow>
        loading={coaches.isLoading}
        rows={coachRows}
        rowKey={(c) => c.memberId}
        minWidthClass="min-w-0"
        paginationLabel="Coach changes pagination"
        empty={{ title: 'No coach changes waiting', description: 'Requests appear here when a coach asks to change their name or date of birth.' }}
        columns={[
          { key: 'name', header: 'Coach', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'now', header: 'Now', hideBelow: 'sm', cell: (c) => <Pair first={c.name} second={c.birthDate || 'No date of birth'} /> },
          { key: 'wants', header: 'Wants', cell: (c) => <Pair first={c.requestedName || c.name} second={c.requestedBirthDate || c.birthDate || 'No date of birth'} /> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={Check}
                  label={`Approve change for ${c.name}`}
                  disabled={approveCoach.isPending}
                  onClick={() => approveCoach.mutate(c.memberId, { onSuccess: () => toast.success(`Approved the change for ${c.name}`), onError: (e) => toast.error(e.message) })}
                />
                <IconButton icon={X} tone="danger" label={`Turn down change for ${c.name}`} onClick={() => setRejectingCoach(c)} />
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={rejectingCoach !== null}
        onClose={() => setRejectingCoach(null)}
        title={`Turn down the change for ${rejectingCoach?.name ?? ''}?`}
        description="The coach sees the reason and keeps their current details."
        actions={
          <>
            <Button variant="ghost" onClick={() => setRejectingCoach(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={rejectCoach.isPending || !reason.trim()}
              onClick={() =>
                rejectingCoach &&
                rejectCoach.mutate(
                  { id: rejectingCoach.memberId, reason },
                  {
                    onSuccess: () => {
                      toast.success(`Turned down the change for ${rejectingCoach.name}`)
                      setRejectingCoach(null)
                      setReason('')
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {rejectCoach.isPending ? 'Saving…' : 'Turn down'}
            </Button>
          </>
        }
      >
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Turn down the change for ${rejecting?.name ?? ''}?`}
        description="The athlete sees the reason and keeps their current details."
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
