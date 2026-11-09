import { membershipLabel, membershipState, type AthleteRecord, type AthleteRow } from '@bis/shared'
import { Check, KeyRound, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Dialog, ErrorState, IconButton, Input, PageHeader, SearchField, Select, Table, Textarea, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import { useAthleteRecords, useAthletes, useCompetitorRows, useDeleteAthleteRecord, useTeams, useConfirmMembership, useCorrectAthlete, useDeleteAthlete, useRejectMembership, useResetAthletePassword } from '../../hooks/index.ts'

import { useAuth } from '../../stores/auth.ts'
import { AthleteRecordDialog } from './AthleteRecordDialog.tsx'

type Filter = 'all' | 'waiting' | 'records'

const isWaiting = (a: AthleteRow) => a.request !== null && !a.request.rejectedReason

// Everyone who dances: accounts, athletes the secretariat added, and dancers known only from an entry form
type Row =
  | { key: string; kind: 'account'; name: string; a: AthleteRow }
  | { key: string; kind: 'record'; name: string; r: AthleteRecord }
  | { key: string; kind: 'dancer'; name: string; teamName: string; prefill: Partial<AthleteRecord> }

const plain = (name: string) => name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()

// The paid-until date, or a label when it was never paid or has run out
function MembershipCell({ year }: { year: number | null }) {
  const now = new Date().getFullYear()
  const state = membershipState(year, now)
  if (state === 'paid') return <span>{membershipLabel(year, now)}</span>
  return (
    <span className="flex flex-col gap-0.5">
      <Badge tone={state === 'expired' ? 'danger' : 'neutral'}>{state === 'expired' ? 'Membership expired' : 'Not paid'}</Badge>
      {state === 'expired' && <span className="font-mono text-small text-neutral-600">{membershipLabel(year, now)}</span>}
    </span>
  )
}

function PaymentCell({ athlete, onView }: { athlete: AthleteRow; onView: (athlete: AthleteRow) => void }) {
  const { request } = athlete
  if (!request) return <span className="text-neutral-500">–</span>
  return (
    <span className="flex flex-col gap-0.5">
      <Badge tone={request.rejectedReason ? 'danger' : 'gold'}>{request.rejectedReason ? 'Not confirmed' : 'Waiting'}</Badge>
      {request.receipt ? (
        <button type="button" onClick={() => onView(athlete)} className="w-fit text-left text-small text-neutral-700 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
          {request.method} screenshot
        </button>
      ) : (
        <span className="font-mono text-small text-neutral-600">
          {request.method} {request.reference}
        </span>
      )}
    </span>
  )
}

export function AthletesPage() {
  const athletes = useAthletes()
  const confirm = useConfirmMembership()
  const reject = useRejectMembership()
  const reset = useResetAthletePassword()
  const remove = useDeleteAthlete()
  const correct = useCorrectAthlete()
  const isAdmin = useAuth((s) => s.user?.role === 'admin')
  const [toCorrect, setToCorrect] = useState<AthleteRow | null>(null)
  const [fixName, setFixName] = useState('')
  const [fixBirth, setFixBirth] = useState('')
  const [viewing, setViewing] = useState<AthleteRow | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [rejecting, setRejecting] = useState<AthleteRow | null>(null)
  const [reason, setReason] = useState('')
  const [toReset, setToReset] = useState<AthleteRow | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AthleteRow | null>(null)
  const [editingRecord, setEditingRecord] = useState<AthleteRecord | 'new' | null>(null)
  const [prefill, setPrefill] = useState<Partial<AthleteRecord> | null>(null)
  const [recordToDelete, setRecordToDelete] = useState<AthleteRecord | null>(null)
  const records = useAthleteRecords()
  const competitors = useCompetitorRows()
  const teamList = useTeams()
  const removeRecord = useDeleteAthleteRecord()

  if (athletes.isError) return <ErrorState onRetry={() => void athletes.refetch()} />

  const needle = query.trim().toLowerCase()
  const teamName = (id: string | null) => teamList.data?.find((t) => t.id === id)?.name ?? ''
  const known = new Set([...(athletes.data ?? []).map((x) => plain(x.name)), ...(records.data ?? []).map((x) => plain(x.name))])
  const dancers = new Map<string, Row>()
  for (const c of competitors.data ?? []) {
    for (const name of c.names) {
      const key = plain(name)
      if (!known.has(key) && !dancers.has(key)) {
        const d = c.details?.dancers[c.names.indexOf(name)]
        dancers.set(key, {
          key: 'dancer-' + key,
          kind: 'dancer',
          name,
          teamName: teamName(c.teamId),
          prefill: { name, teamId: c.teamId, coachId: c.details?.coachId ?? null, province: c.details?.province ?? '', birthDate: d?.birthDate ?? '', phone: d?.phone ?? '', address: d?.address ?? '' },
        })
      }
    }
  }
  const all: Row[] = [
    ...(athletes.data ?? []).map((x): Row => ({ key: x.id, kind: 'account', name: x.name, a: x })),
    ...(records.data ?? []).map((x): Row => ({ key: x.id, kind: 'record', name: x.name, r: x })),
    ...dancers.values(),
  ].sort((x, y) => x.name.localeCompare(y.name))
  const rows = all.filter((row) => {
    if (filter === 'waiting') return row.kind === 'account' && isWaiting(row.a)
    if (filter === 'records' && row.kind === 'account') return false
    const text = row.kind === 'account' ? [row.a.name, row.a.email, row.a.teamName, row.a.membershipId ?? ''] : row.kind === 'record' ? [row.name, teamName(row.r.teamId), row.r.membershipId ?? ''] : [row.name, row.teamName]
    return !needle || text.some((v) => v.toLowerCase().includes(needle))
  })

  function closeReset() {
    setToReset(null)
    setTempPassword(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Athletes" description="Athletes with an account, and athletes you added who have not linked one yet. Confirm a membership once the money has arrived." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search athletes" value={query} onChange={setQuery} />
        <Select label="Show" hideLabel className="w-full sm:w-52" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All athletes</option>
          <option value="waiting">Waiting for you</option>
          <option value="records">Not signed up yet</option>
        </Select>
        <ToolbarActions>
          <Button
            onClick={() => {
              setEditingRecord('new')
            }}
          >
            Add athlete
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Row>
        loading={athletes.isLoading || records.isLoading || competitors.isLoading}
        rows={rows}
        rowKey={(row) => row.key}
        minWidthClass="min-w-0"
        paginationLabel="Athletes pagination"
        detailTitle={(row) => row.name}
        empty={
          needle || filter === 'waiting'
            ? { title: 'No athletes match', description: 'Try a different name or filter.' }
            : { title: 'No athletes yet', description: 'Athletes appear here once they make an account, are added, or are entered in a competition.' }
        }
        columns={[
          { key: 'name', header: 'Athlete', cell: (row) => <span className="font-medium">{row.name}</span> },
          { key: 'id', header: 'Membership ID', cell: (row) => (row.kind === 'account' ? row.a.membershipId : row.kind === 'record' ? row.r.membershipId : null) ?? '–', mono: true, muted: true, hideBelow: 'sm' },
          { key: 'email', header: 'Email', cell: (row) => (row.kind === 'account' ? row.a.email : '–'), muted: true, hideBelow: 'md' },
          { key: 'team', header: 'Team', cell: (row) => (row.kind === 'account' ? row.a.teamName : row.kind === 'record' ? teamName(row.r.teamId) : row.teamName) || '–', muted: true, hideBelow: 'md' },
          {
            key: 'member',
            header: 'Membership',
            cell: (row) => <MembershipCell year={row.kind === 'dancer' ? null : row.kind === 'account' ? row.a.memberYear : row.r.memberYear} />,
            mono: true,
            muted: true,
            hideBelow: 'sm',
          },
          {
            key: 'payment',
            header: 'Payment',
            cell: (row) => (row.kind === 'account' ? <PaymentCell athlete={row.a} onView={setViewing} /> : <span className="text-neutral-500">{row.kind === 'record' ? 'No account yet' : 'Entry form only'}</span>),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-44',
            cell: (row) => {
              if (row.kind === 'dancer') {
                return (
                  <div className="flex justify-end gap-0.5">
                    <IconButton icon={UserPlus} label={`Add ${row.name} as an athlete`} onClick={() => setPrefill(row.prefill)} />
                  </div>
                )
              }
              if (row.kind === 'record') {
                return (
                  <div className="flex justify-end gap-0.5">
                    <IconButton icon={Pencil} label={`Edit ${row.name}`} onClick={() => setEditingRecord(row.r)} />
                    <IconButton icon={Trash2} tone="danger" label={`Delete ${row.name}`} onClick={() => setRecordToDelete(row.r)} />
                  </div>
                )
              }
              const a = row.a
              return (
                <div className="flex justify-end gap-0.5">
                  {a.request && isWaiting(a) && (
                    <>
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
                      <IconButton icon={X} tone="danger" label={`Turn down payment of ${a.name}`} onClick={() => setRejecting(a)} />
                    </>
                  )}
                  {isAdmin && (
                    <IconButton
                      icon={Pencil}
                      label={`Correct name or date of birth of ${a.name}`}
                      onClick={() => {
                        setToCorrect(a)
                        setFixName(a.name)
                        setFixBirth(a.birthDate)
                      }}
                    />
                  )}
                  <IconButton icon={KeyRound} label={`Reset password of ${a.name}`} onClick={() => setToReset(a)} />
                  <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setToDelete(a)} />
                </div>
              )
            },
          },
        ]}
      />

      <AthleteRecordDialog
        open={editingRecord !== null || prefill !== null}
        athlete={editingRecord === 'new' ? null : editingRecord}
        prefill={prefill ?? undefined}
        onClose={() => {
          setEditingRecord(null)
          setPrefill(null)
        }}
      />

      <Dialog
        open={recordToDelete !== null}
        onClose={() => setRecordToDelete(null)}
        title={`Delete ${recordToDelete?.name ?? ''}?`}
        description="This athlete has no account yet. An account waiting to be linked to it is left unlinked."
        actions={
          <>
            <Button variant="ghost" onClick={() => setRecordToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={removeRecord.isPending}
              onClick={() =>
                recordToDelete &&
                removeRecord.mutate(recordToDelete.id, {
                  onSuccess: () => {
                    toast.success(`Deleted ${recordToDelete.name}`)
                    setRecordToDelete(null)
                  },
                  onError: (e) => {
                    setRecordToDelete(null)
                    toast.error(e.message)
                  },
                })
              }
            >
              {removeRecord.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />

      <Dialog
        open={toCorrect !== null}
        onClose={() => setToCorrect(null)}
        title={`Correct ${toCorrect?.name ?? ''}`}
        description="Athletes cannot change these themselves. Results and rankings follow the name, and the birth date decides the age group."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToCorrect(null)}>
              Cancel
            </Button>
            <Button
              disabled={correct.isPending || !fixName.trim()}
              onClick={() =>
                toCorrect &&
                correct.mutate(
                  { id: toCorrect.id, name: fixName, birthDate: fixBirth },
                  {
                    onSuccess: () => {
                      toast.success(`Corrected ${fixName.trim()}`)
                      setToCorrect(null)
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {correct.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Full name" required value={fixName} onChange={(e) => setFixName(e.target.value)} />
          <Input label="Date of birth" type="date" value={fixBirth} onChange={(e) => setFixBirth(e.target.value)} />
        </div>
      </Dialog>

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
        <Textarea label="Reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`Payment of ${viewing?.name ?? ''}`}
        description={viewing?.request ? `${viewing.request.method}, ${viewing.request.year} membership` : undefined}
        actions={
          <Button variant="ghost" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewing?.request?.receipt && <img src={viewing.request.receipt} alt={`Payment screenshot of ${viewing.name}`} className="max-h-[60vh] w-full rounded-md border border-neutral-200 object-contain" />}
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

      <DeleteDialog kind="athlete" target={toDelete ? { id: toDelete.id, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
