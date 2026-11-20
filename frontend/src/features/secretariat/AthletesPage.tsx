import { membershipPaidText, type AthleteRecord, type AthleteRow, type CompetitorRow } from '@bis/shared'
import { Check, ListPlus, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Badge, Button, Dialog, ErrorState, IconButton, Input, PageHeader, SearchField, Select, Table, Textarea, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { DeleteDialog } from '../../components/DeleteDialog.tsx'
import {
  useAssignBackNumbers,
  useAthleteRecords,
  useAthletes,
  useCompetitionEntries,
  useCompetitions,
  useCompetitorRows,
  useDeleteAthleteRecord,
  useDeleteCompetitor,
  useEvents,
  useTeams,
  useConfirmMembership,
  useCorrectAthlete,
  useDeleteAthlete,
  useRejectMembership,
} from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { ActivityOf, AthleteEntries } from './AthleteEntries.tsx'
import { ACTIVITY } from './athleteActivity.tsx'
import { AthleteRecordDialog } from './AthleteRecordDialog.tsx'
import { BackNumberDialog } from './BackNumberDialog.tsx'
import { CompetitorDialog } from './CompetitorDialog.tsx'
import { EntryChooser } from './EntryChooser.tsx'
import { ImportDialog } from './ImportDialog.tsx'
import { RegistrationDialog } from './RegistrationDialog.tsx'

type Filter = 'all' | 'paid' | 'unpaid' | 'waiting' | 'records'

const isWaiting = (a: AthleteRow) => a.request !== null && !a.request.rejectedReason

// Everyone who dances: accounts, athletes the secretariat added, and dancers known only from an entry form
type Row =
  | { key: string; kind: 'account'; name: string; a: AthleteRow }
  | { key: string; kind: 'record'; name: string; r: AthleteRecord }
  | { key: string; kind: 'dancer'; name: string; teamName: string }

// Paid for this year; a dancer known only from an entry form has not paid
const isPaid = (row: Row) => membershipPaidText(row.kind === 'dancer' ? null : row.kind === 'account' ? row.a.memberYear : row.r.memberYear, new Date().getFullYear()) === 'Paid'

const plain = (name: string) => name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()

// Paid for this year, or not
function MembershipCell({ year }: { year: number | null }) {
  const text = membershipPaidText(year, new Date().getFullYear())
  return <span>{text}</span>
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
  const [toDelete, setToDelete] = useState<AthleteRow | null>(null)
  const [editingRecord, setEditingRecord] = useState<AthleteRecord | null>(null)
  const [recordToDelete, setRecordToDelete] = useState<AthleteRecord | null>(null)
  const records = useAthleteRecords()
  const competitors = useCompetitorRows()
  const teamList = useTeams()
  const removeRecord = useDeleteAthleteRecord()
  const competitions = useCompetitions()
  const assign = useAssignBackNumbers()
  const removeEntry = useDeleteCompetitor()
  const [competitionId, setCompetitionId] = useState('all')
  const [eventId, setEventId] = useState('all')
  // The team filter lives in the address (?team=<id>), so the teams page can link to one team's athletes
  const [params, setParams] = useSearchParams()
  const teamId = params.get('team') ?? 'all'
  const setTeamId = (id: string) =>
    setParams(
      (p) => {
        if (id === 'all') p.delete('team')
        else p.set('team', id)
        return p
      },
      { replace: true },
    )
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [entering, setEntering] = useState<CompetitorRow | null>(null)
  const [numbering, setNumbering] = useState<CompetitorRow | null>(null)
  const [editingEntry, setEditingEntry] = useState<CompetitorRow | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<CompetitorRow | null>(null)
  // Entry details being added for an athlete who has none, by name
  const [entryFor, setEntryFor] = useState<string | null>(null)
  // An athlete in more than one entry is asked which one
  const [choosing, setChoosing] = useState<{ name: string; entries: CompetitorRow[] } | null>(null)
  const scoped = competitionId !== 'all'
  const events = useEvents(scoped ? competitionId : undefined)
  const entryList = useCompetitionEntries(scoped ? competitionId : '')

  if (athletes.isError) return <ErrorState onRetry={() => void athletes.refetch()} />

  const needle = query.trim().toLowerCase()
  const teamName = (id: string | null) => teamList.data?.find((t) => t.id === id)?.name ?? ''
  const known = new Set([...(athletes.data ?? []).map((x) => plain(x.name)), ...(records.data ?? []).map((x) => plain(x.name))])
  const dancers = new Map<string, Row>()
  for (const c of competitors.data ?? []) {
    for (const name of c.names) {
      const key = plain(name)
      if (!known.has(key) && !dancers.has(key)) dancers.set(key, { key: 'dancer-' + key, kind: 'dancer', name, teamName: teamName(c.teamId) })
    }
  }
  const all: Row[] = [
    ...(athletes.data ?? []).map((x): Row => ({ key: x.id, kind: 'account', name: x.name, a: x })),
    ...(records.data ?? []).map((x): Row => ({ key: x.id, kind: 'record', name: x.name, r: x })),
    ...dancers.values(),
  ].sort((x, y) => x.name.localeCompare(y.name))
  const paid = all.filter(isPaid).length

  // The entries an athlete dances in (a solo, a couple), found by name
  const entriesOf = new Map<string, CompetitorRow[]>()
  for (const c of competitors.data ?? []) {
    for (const name of c.names) entriesOf.set(plain(name), [...(entriesOf.get(plain(name)) ?? []), c])
  }
  const entriesFor = (row: Row) => entriesOf.get(plain(row.name)) ?? []
  const missing = (competitors.data ?? []).filter((c) => c.backNumber === null).length
  // With a competition (and event) chosen: what each entry is entered in
  const eventNumber = new Map((events.data ?? []).map((e) => [e.id, e.number]))
  const enteredIn = new Map<string, number[]>()
  if (scoped) {
    for (const e of entryList.data ?? []) {
      if (e.scratched || (eventId !== 'all' && e.eventId !== eventId)) continue
      enteredIn.set(e.competitorId, [...(enteredIn.get(e.competitorId) ?? []), eventNumber.get(e.eventId) ?? 0])
    }
  }
  const eventsOf = (row: Row) => entriesFor(row).flatMap((c) => enteredIn.get(c.id) ?? []).sort((x, y) => x - y)
  const entryCount = (row: Row) => entriesFor(row).reduce((n, c) => n + (scoped ? (enteredIn.get(c.id)?.length ?? 0) : c.entryCount), 0)
  const chosenTeam = teamList.data?.find((c) => c.id === teamId)?.name

  const rows = all.filter((row) => {
    if (filter === 'waiting') return row.kind === 'account' && isWaiting(row.a)
    if (filter === 'records' && row.kind === 'account') return false
    if (filter === 'paid' && !isPaid(row)) return false
    if (filter === 'unpaid' && isPaid(row)) return false
    if (scoped && !entriesFor(row).some((c) => enteredIn.has(c.id))) return false
    if (teamId !== 'all') {
      const rowTeam = row.kind === 'account' ? row.a.teamName : row.kind === 'record' ? teamName(row.r.teamId) : row.teamName
      if (rowTeam !== chosenTeam && !entriesFor(row).some((c) => c.teamId === teamId)) return false
    }
    const own = row.kind === 'account' ? [row.a.name, row.a.email, row.a.teamName, row.a.membershipId ?? ''] : row.kind === 'record' ? [row.name, teamName(row.r.teamId), row.r.membershipId ?? ''] : [row.name, row.teamName]
    const text = [...own, ...entriesFor(row).flatMap((c) => [...c.names, c.backNumber === null ? '' : String(c.backNumber)])]
    return !needle || text.some((v) => v.toLowerCase().includes(needle))
  })

  function assignAll() {
    assign.mutate(undefined, {
      onSuccess: (n) => toast.success(`Assigned ${n} back number${n === 1 ? '' : 's'}`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Athletes" description="Every athlete in one list, paid or not. Confirm a membership once the money has arrived." />

      <Toolbar>
        <SearchField className="min-w-0" label="Search athletes" value={query} onChange={setQuery} />
        <div className="min-w-0">
          <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All athletes</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
            <option value="waiting">Waiting for you</option>
            <option value="records">Not signed up yet</option>
          </Select>
        </div>
        <div className="min-w-0">
          <Select
            label="Competition"
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value)
              setEventId('all')
            }}
          >
            <option value="all">All competitions</option>
            {[...(competitions.data ?? [])]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
        {scoped && (
          <div className="min-w-0">
            <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">All events</option>
              {[...(events.data ?? [])]
                .sort((a, b) => a.number - b.number)
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {eventCode(ev)} {eventDances(ev)}
                  </option>
                ))}
            </Select>
          </div>
        )}
        <div className="min-w-0">
          <Select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="all">All teams</option>
            {(teamList.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarActions>
          {missing > 0 && (
            <Button variant="secondary" disabled={assign.isPending} onClick={assignAll}>
              {`Assign ${missing} back number${missing === 1 ? '' : 's'}`}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Button onClick={() => setAdding(true)}>Add athlete</Button>
        </ToolbarActions>
      </Toolbar>

      {!athletes.isLoading && !records.isLoading && !competitors.isLoading && (
        <p role="status" className="text-small text-neutral-600">
          <span className="font-mono tabular-nums text-neutral-900">{all.length}</span> athletes ·{' '}
          <span className="font-mono tabular-nums text-neutral-900">{paid}</span> paid ·{' '}
          <span className="font-mono tabular-nums text-neutral-900">{all.length - paid}</span> not paid
        </p>
      )}

      <Table<Row>
        loading={athletes.isLoading || records.isLoading || competitors.isLoading}
        rows={rows}
        rowKey={(row) => row.key}
        minWidthClass="min-w-0"
        paginationLabel="Athletes pagination"
        detailTitle={(row) => row.name}
        detailExtra={(row) => (
          <AthleteEntries
            athlete={row.name}
            entries={entriesFor(row)}
            plain={plain}
            actions={{ onEnter: setEntering, onNumber: setNumbering, onEdit: setEditingEntry, onDelete: setEntryToDelete, onAddDetails: () => setEntryFor(row.name) }}
          />
        )}
        detailSections={(row) => ACTIVITY.map((a) => ({ id: a.id, label: a.label, icon: a.icon, content: <ActivityOf athlete={row.name} entries={entriesFor(row)} plain={plain} render={a.render} /> }))}
        empty={
          needle || filter !== 'all' || scoped || teamId !== 'all'
            ? { title: 'No athletes match', description: 'Try a different name or filter.' }
            : { title: 'No athletes yet', description: 'Athletes appear here once they make an account, are added, or are entered in a competition.' }
        }
        columns={[
          { key: 'name', header: 'Athlete', cell: (row) => <span className="font-medium">{row.name}</span> },
          { key: 'id', header: 'Membership ID', cell: (row) => (row.kind === 'account' ? row.a.membershipId : row.kind === 'record' ? row.r.membershipId : null) ?? '–', mono: true, muted: true, hideBelow: 'sm' },
          { key: 'email', header: 'Email', cell: (row) => (row.kind === 'account' ? row.a.email : '–'), muted: true, hideBelow: '2xl' },
          { key: 'team', header: 'Team', cell: (row) => (row.kind === 'account' ? row.a.teamName : row.kind === 'record' ? teamName(row.r.teamId) : row.teamName) || '–', muted: true, hideBelow: 'md' },
          {
            key: 'member',
            header: 'Membership',
            cell: (row) => <MembershipCell year={row.kind === 'dancer' ? null : row.kind === 'account' ? row.a.memberYear : row.r.memberYear} />,
            mono: true,
            muted: true,
          },
          {
            key: 'back',
            header: 'Back no.',
            cell: (row) => {
              const numbers = entriesFor(row).map((c) => c.backNumber)
              return numbers.length === 0 ? '–' : numbers.map((n) => n ?? '–').join(', ')
            },
            mono: true,
            muted: true,
            align: 'center',
            hideBelow: 'md',
          },
          ...(scoped ? [{ key: 'events', header: 'Events', cell: (row: Row) => eventsOf(row).map((n) => `E${n}`).join(', ') || '–', mono: true, muted: true, hideBelow: 'md' as const }] : []),
          { key: 'entries', header: 'Entries', cell: (row) => entryCount(row), mono: true, align: 'center', hideBelow: 'md' },
          { key: 'account', header: 'Account', cell: (row) => (row.kind === 'account' ? 'Account' : row.kind === 'record' ? 'No account yet' : 'Entry form only'), muted: true, hideBelow: 'md', detailOnly: true },
          {
            key: 'payment',
            header: 'Payment',
            cell: (row) => (row.kind === 'account' ? <PaymentCell athlete={row.a} onView={setViewing} /> : <span className="text-neutral-500">–</span>),
            detailOnly: true,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-52',
            cell: (row) => {
              const entries = entriesFor(row)
              const enter =
                entries.length > 0 ? (
                  <IconButton
                    icon={ListPlus}
                    label={`Enter ${row.name} in events`}
                    onClick={() => (entries.length === 1 ? setEntering(entries[0]!) : setChoosing({ name: row.name, entries }))}
                  />
                ) : null
              if (row.kind === 'dancer') return <div className="flex justify-end gap-0.5">{enter}</div>
              if (row.kind === 'record') {
                return (
                  <div className="flex justify-end gap-0.5">
                    {enter}
                    <IconButton icon={Pencil} label={`Edit ${row.name}`} onClick={() => setEditingRecord(row.r)} />
                    <IconButton icon={Trash2} tone="danger" label={`Delete ${row.name}`} onClick={() => setRecordToDelete(row.r)} />
                  </div>
                )
              }
              const a = row.a
              return (
                <div className="flex justify-end gap-0.5">
                  {enter}
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
                  <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setToDelete(a)} />
                </div>
              )
            },
          },
        ]}
      />

      <AthleteRecordDialog open={editingRecord !== null} athlete={editingRecord} onClose={() => setEditingRecord(null)} />
      <CompetitorDialog
        open={adding}
        competitor={null}
        intent="athlete"
        onClose={() => setAdding(false)}
        onAdded={() => {
          // A new athlete has no entries yet, so any filter would hide them
          setCompetitionId('all')
          setEventId('all')
          setQuery('')
          setTeamId('all')
          setFilter('all')
        }}
      />
      <CompetitorDialog open={entryFor !== null} competitor={null} intent="entry" prefillName={entryFor ?? undefined} onClose={() => setEntryFor(null)} />
      <CompetitorDialog open={editingEntry !== null} competitor={editingEntry} onClose={() => setEditingEntry(null)} />
      <DeleteDialog kind="competitor" target={entryToDelete ? { id: entryToDelete.id, label: competitorName(entryToDelete.names) } : null} remove={removeEntry} onClose={() => setEntryToDelete(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
      <BackNumberDialog competitor={numbering} onClose={() => setNumbering(null)} />
      <RegistrationDialog competitor={entering} onClose={() => setEntering(null)} />
      <EntryChooser
        athlete={choosing?.name ?? null}
        entries={choosing?.entries ?? []}
        plain={plain}
        onChoose={(entry) => {
          setChoosing(null)
          setEntering(entry)
        }}
        onClose={() => setChoosing(null)}
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

      <DeleteDialog kind="athlete" target={toDelete ? { id: toDelete.id, label: toDelete.name } : null} remove={remove} onClose={() => setToDelete(null)} />
    </div>
  )
}
