import { Role, type CloudCompetition } from '@bis/shared'
import { CloudDownload, CloudUpload, Unplug } from 'lucide-react'
import { useState } from 'react'
import { Fact } from '../../components/Fact.tsx'
import { Button, Dialog, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, Table, toast } from '../../components/ui/index.ts'
import { useCloudCompetitions, usePullCompetition, useReleaseCompetition, useSyncNow, useSyncStatus, useUploadCompetition } from '../../hooks/index.ts'
import { formatDate, formatDateTime } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'

export function SyncPage() {
  const role = useAuth((s) => s.user?.role)
  const isAdmin = role === Role.Admin
  const status = useSyncStatus()
  const enabled = status.data?.enabled === true
  const cloud = useCloudCompetitions(enabled)
  const pull = usePullCompetition()
  const send = useSyncNow()
  const upload = useUploadCompetition()
  const release = useReleaseCompetition()
  const [toRelease, setToRelease] = useState<CloudCompetition | null>(null)

  if (status.isError) return <ErrorState onRetry={() => void status.refetch()} />

  const data = status.data
  const held = new Set(data?.held ?? [])

  function download(c: CloudCompetition) {
    pull.mutate(c.id, {
      onSuccess: (s) =>
        toast.success(
          `Downloaded ${c.name}${s.excludedEntries > 0 ? `. ${s.excludedEntries} unpaid ${s.excludedEntries === 1 ? 'entry was' : 'entries were'} left out.` : ''}`,
        ),
      onError: (e) => toast.error(e.message),
    })
  }

  function sendNow() {
    send.mutate(undefined, {
      onSuccess: (s) => (s.lastError ? toast.error(s.lastError) : toast.success('Everything is on the cloud')),
      onError: (e) => toast.error(e.message),
    })
  }

  function sendAgain(c: CloudCompetition) {
    upload.mutate(c.id, {
      onSuccess: () => toast.success(`Sent all of ${c.name} again`),
      onError: (e) => toast.error(e.message),
    })
  }

  function confirmRelease(c: CloudCompetition) {
    release.mutate(c.id, {
      onSuccess: () => {
        setToRelease(null)
        toast.success(`${c.name} is back online`)
      },
      onError: (e) => {
        setToRelease(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cloud sync"
        description="Download a competition before the event. Results go back to the cloud as they happen."
      />

      {!data ? (
        <Skeleton className="h-24 w-full max-w-3xl" />
      ) : !data.enabled ? (
        <EmptyState title="This laptop is working on its own" description="It has no cloud address, so nothing is downloaded or sent. Set one up as described in VENUE.md." />
      ) : (
        <>
          <dl className="grid max-w-3xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <Fact label="Cloud">{data.reachable === false ? 'Cannot be reached' : data.reachable ? 'Connected' : 'Not tried yet'}</Fact>
            <Fact label="Waiting to send">{data.pending}</Fact>
            <Fact label="Last sent">{data.lastUploadAt ? formatDateTime(data.lastUploadAt) : 'Never'}</Fact>
            <Fact label="This venue">{data.venueId}</Fact>
          </dl>

          {data.lastError && (
            <p role="alert" className="max-w-3xl text-small text-danger">
              {data.lastError}
            </p>
          )}

          <div>
            <Button variant="secondary" disabled={send.isPending} onClick={sendNow}>
              {send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </div>

          {cloud.isError ? (
            <ErrorState onRetry={() => void cloud.refetch()} />
          ) : (
            <Table<CloudCompetition>
              loading={cloud.isLoading}
              rows={cloud.data ?? []}
              rowKey={(c) => c.id}
              minWidthClass="min-w-0"
              paginationLabel="Cloud competitions pagination"
              empty={{ title: 'No competitions on the cloud', description: 'Create one online first, then download it here.' }}
              columns={[
                {
                  key: 'name',
                  header: 'Competition',
                  cell: (c) => (
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium text-neutral-900">{c.name}</span>
                      <span className="truncate text-small text-neutral-600">{c.venue}</span>
                    </div>
                  ),
                },
                { key: 'date', header: 'Date', cell: (c) => formatDate(c.date), hideBelow: 'sm' },
                { key: 'entries', header: 'Entries', cell: (c) => c.entries, mono: true, align: 'right', hideBelow: 'sm' },
                {
                  key: 'state',
                  header: 'Run at',
                  cell: (c) => (held.has(c.id) ? 'This venue' : (c.heldBy ?? 'Online')),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  widthClass: 'w-28',
                  cell: (c) => (
                    <div className="flex justify-end gap-0.5">
                      {(held.has(c.id) || !c.heldBy) && (
                        <IconButton
                          icon={CloudDownload}
                          label={held.has(c.id) ? `Download ${c.name} again` : `Download ${c.name}`}
                          disabled={pull.isPending}
                          onClick={() => download(c)}
                        />
                      )}
                      {isAdmin && held.has(c.id) && (
                        <>
                          <IconButton icon={CloudUpload} label={`Send all of ${c.name} again`} disabled={upload.isPending} onClick={() => sendAgain(c)} />
                          <IconButton icon={Unplug} label={`Release ${c.name}`} onClick={() => setToRelease(c)} />
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </>
      )}

      <Dialog
        open={toRelease !== null}
        onClose={() => setToRelease(null)}
        title={`Release ${toRelease?.name ?? ''}?`}
        description="Use this when the event is over and everything has been sent. Entries and payments can then change online again."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToRelease(null)}>
              Cancel
            </Button>
            <Button disabled={release.isPending} onClick={() => toRelease && confirmRelease(toRelease)}>
              {release.isPending ? 'Releasing…' : 'Release'}
            </Button>
          </>
        }
      />
    </div>
  )
}
