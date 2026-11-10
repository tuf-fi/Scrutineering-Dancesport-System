import type { OfflineDayCompetition, OfflineDayCounts } from '@bis/shared'
import { useRef, useState } from 'react'
import { Button, Dialog, ErrorState, PageHeader, Table, toast } from '../../components/ui/index.ts'
import { buttonStyles } from '../../components/ui/buttonStyles.ts'
import { useCancelOfflineDay, useLoadDayFile, useOfflineDays, useStartOfflineDay } from '../../hooks/index.ts'
import { formatDate, formatDateTime } from '../../lib/format.ts'

export const DATABASE_COPY_URL = '/api/offline/database'
export const dayFileUrl = (competitionId: string) => `/api/offline/day?competition=${encodeURIComponent(competitionId)}`

const COUNT_LABEL: Record<string, string> = {
  rounds: 'Rounds',
  heats: 'Heats',
  marks: 'Marks',
  submissions: 'Adjudicator sheets',
  results: 'Results',
  ranking_points: 'Ranking points',
  entries: 'Entries',
  payments: 'Payments',
  entry_requests: 'Entry requests',
  competitors: 'New dancers',
  teams: 'New teams',
  coaches: 'New coaches',
  events: 'New events',
}

function Summary({ counts }: { counts: OfflineDayCounts }) {
  const rows = [...Object.entries(counts.replaced), ...Object.entries(counts.added)].filter(([, n]) => n > 0)
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-small">
      {rows.map(([table, n]) => (
        <div key={table} className="contents">
          <dt className="text-neutral-600">{COUNT_LABEL[table] ?? table}</dt>
          <dd className="text-right font-mono text-neutral-900">{n}</dd>
        </div>
      ))}
      <dt className="text-neutral-600">Back numbers</dt>
      <dd className="text-right font-mono text-neutral-900">{counts.backNumbers}</dd>
    </dl>
  )
}

// Loads the file the venue laptop made: a trial first, which keeps nothing, then the real thing
function LoadDayDialog({ competition, onClose }: { competition: OfflineDayCompetition | null; onClose: () => void }) {
  const load = useLoadDayFile()
  const picker = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [counts, setCounts] = useState<OfflineDayCounts | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFile(null)
    setCounts(null)
    setFailure(null)
    load.reset()
    onClose()
  }

  function choose(chosen: File | undefined) {
    setCounts(null)
    setFailure(null)
    setFile(chosen ?? null)
    if (!chosen) return
    load.mutate({ file: chosen, dryRun: true }, { onSuccess: setCounts, onError: (e) => setFailure(e.message) })
  }

  function keep() {
    if (!file) return
    load.mutate(
      { file, dryRun: false },
      {
        onSuccess: () => {
          toast.success('The day is loaded')
          close()
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <Dialog
      open={competition !== null}
      onClose={close}
      title="Load the day file"
      description={competition ? `The file the venue laptop made for ${competition.name}.` : undefined}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={keep} disabled={!counts || load.isPending}>
            {load.isPending && counts ? 'Loading…' : 'Load it'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={picker} type="file" accept="application/json,.json" aria-label="Day file" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          <Button variant="secondary" onClick={() => picker.current?.click()}>
            {file ? 'Choose another file' : 'Choose the file'}
          </Button>
          {file && <span className="min-w-0 truncate text-small text-neutral-600">{file.name}</span>}
        </div>
        {load.isPending && !counts && <p className="text-small text-neutral-600">Checking the file…</p>}
        {failure && (
          <p role="alert" className="text-small text-danger">
            {failure}
          </p>
        )}
        {counts && (
          <div className="flex flex-col gap-3">
            <p className="text-small text-neutral-800">The file is fine. Loading it replaces this competition&rsquo;s rounds, marks, results, entries and payments with these:</p>
            <Summary counts={counts} />
          </div>
        )}
      </div>
    </Dialog>
  )
}

type Action = { kind: 'start' | 'cancel' | 'load'; competition: OfflineDayCompetition }

export function OfflineDayPage() {
  const days = useOfflineDays()
  const start = useStartOfflineDay()
  const cancel = useCancelOfflineDay()
  const [action, setAction] = useState<Action | null>(null)

  if (days.isError) return <ErrorState onRetry={() => void days.refetch()} />
  const venue = days.data?.venue ?? false

  function confirm(kind: 'start' | 'cancel', competition: OfflineDayCompetition) {
    const run = kind === 'start' ? start : cancel
    run.mutate(competition.id, {
      onSuccess: () => {
        setAction(null)
        toast.success(kind === 'start' ? 'Handed to the venue laptop' : 'Taken back')
      },
      onError: (e) => {
        setAction(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Offline day"
        description={
          venue
            ? 'This is the venue laptop. When the competition is over, download its day file and load it on the online server.'
            : 'Run a competition from a laptop at the venue when there is no signal. Hand it over here first, copy the database to the laptop, and load the laptop’s day file back afterwards.'
        }
        actions={
          !venue && (
            <a href={DATABASE_COPY_URL} download className={buttonStyles('secondary', 'md')}>
              Download database copy
            </a>
          )
        }
      />

      <Table<OfflineDayCompetition>
        loading={days.isLoading}
        rows={days.data?.competitions ?? []}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Offline day pagination"
        empty={{ title: 'No competitions yet', description: 'Create a competition first.' }}
        columns={[
          {
            key: 'name',
            header: 'Competition',
            cell: (c) => (
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-neutral-900">{c.name}</span>
                <span className="text-small text-neutral-600">{formatDate(c.date)}</span>
              </div>
            ),
          },
          {
            key: 'state',
            header: 'Where it runs',
            cell: (c) => (c.heldAt ? `Venue laptop, since ${formatDateTime(c.heldAt)}` : venue ? 'On this laptop' : 'Online'),
            muted: true,
            hideBelow: 'sm',
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (c) => (
              <div className="flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {venue ? (
                  <a href={dayFileUrl(c.id)} download aria-label={`Download the day file of ${c.name}`} className={buttonStyles('secondary', 'sm')}>
                    Download day file
                  </a>
                ) : c.heldAt ? (
                  <>
                    <Button size="sm" onClick={() => setAction({ kind: 'load', competition: c })} aria-label={`Load the day file of ${c.name}`}>
                      Load day file
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'cancel', competition: c })} aria-label={`Take back ${c.name}`}>
                      Take back
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'start', competition: c })} aria-label={`Start the offline day of ${c.name}`}>
                    Start offline day
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={action?.kind === 'start'}
        onClose={() => setAction(null)}
        title="Hand this competition to the venue laptop?"
        description={action ? `${action.competition.name} will be paused online: staff changes and new entry requests stop until the laptop's day is loaded back or you take it back.` : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button onClick={() => action && confirm('start', action.competition)} disabled={start.isPending}>
              {start.isPending ? 'Handing over…' : 'Hand it over'}
            </Button>
          </>
        }
      />
      <Dialog
        open={action?.kind === 'cancel'}
        onClose={() => setAction(null)}
        title="Take it back without loading anything?"
        description={action ? `${action.competition.name} goes back to being run online. Whatever the venue laptop did is not loaded.` : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => action && confirm('cancel', action.competition)} disabled={cancel.isPending}>
              {cancel.isPending ? 'Taking back…' : 'Take it back'}
            </Button>
          </>
        }
      />
      <LoadDayDialog competition={action?.kind === 'load' ? action.competition : null} onClose={() => setAction(null)} />
    </div>
  )
}
