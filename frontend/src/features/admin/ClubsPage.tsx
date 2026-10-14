import type { Club } from '@bis/shared'
import { KeyRound, UserX } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useClearOldReceipts, useClubs, useEraseClubAccount, useResetClubPassword } from '../../hooks/index.ts'
import { TempPasswordDialog } from './TempPasswordDialog.tsx'

export function ClubsPage() {
  const clubs = useClubs()
  const reset = useResetClubPassword()
  const erase = useEraseClubAccount()
  const clear = useClearOldReceipts()
  const [query, setQuery] = useState('')
  const [toReset, setToReset] = useState<Club | null>(null)
  const [toErase, setToErase] = useState<Club | null>(null)
  const [clearing, setClearing] = useState(false)
  const [shown, setShown] = useState<{ person: string; password: string } | null>(null)

  if (clubs.isError) return <ErrorState onRetry={() => void clubs.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (clubs.data ?? []).filter((c) => !needle || [c.name, c.contactName, c.contactEmail].some((v) => v.toLowerCase().includes(needle)))

  function confirmReset(club: Club) {
    reset.mutate(club.id, {
      onSuccess: ({ tempPassword }) => {
        setToReset(null)
        setShown({ person: club.contactName, password: tempPassword })
      },
      onError: (e) => {
        setToReset(null)
        toast.error(e.message)
      },
    })
  }

  function confirmErase(club: Club) {
    erase.mutate(club.id, {
      onSuccess: () => {
        setToErase(null)
        toast.success(`Erased the account of ${club.name}`)
      },
      onError: (e) => {
        setToErase(null)
        toast.error(e.message)
      },
    })
  }

  function confirmClear() {
    clear.mutate(undefined, {
      onSuccess: (n) => {
        setClearing(false)
        toast.success(n === 0 ? 'Nothing was old enough to remove' : `Removed ${n} payment ${n === 1 ? 'proof' : 'proofs'}`)
      },
      onError: (e) => {
        setClearing(false)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs" description="Club accounts: help with a forgotten password, or erase an account when a club asks." />

      <Toolbar>
        <SearchField className="w-full sm:w-72" value={query} onChange={setQuery} />
        <ToolbarActions>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setClearing(true)}>
            Remove old payment proofs
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<Club>
        loading={clubs.isLoading}
        rows={rows}
        rowKey={(c) => c.id}
        minWidthClass="min-w-0"
        paginationLabel="Clubs pagination"
        empty={needle ? { title: 'No clubs match', description: 'Try a different name or email.' } : { title: 'No clubs yet', description: 'Clubs appear here when they sign up.' }}
        columns={[
          { key: 'name', header: 'Club', cell: (c) => <span className="font-medium text-neutral-900">{c.name}</span> },
          { key: 'contact', header: 'Contact', cell: (c) => c.contactName, muted: true, hideBelow: 'sm' },
          { key: 'email', header: 'Email', cell: (c) => c.contactEmail, muted: true, hideBelow: 'md' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={KeyRound} label={`Reset the password of ${c.name}`} onClick={() => setToReset(c)} />
                <IconButton icon={UserX} tone="danger" label={`Erase the account of ${c.name}`} onClick={() => setToErase(c)} />
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={toReset !== null}
        onClose={() => setToReset(null)}
        title={`Reset the password of ${toReset?.name ?? ''}?`}
        description="They are signed out of nothing, but their old password stops working. You get a temporary one to pass on."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToReset(null)}>
              Cancel
            </Button>
            <Button disabled={reset.isPending} onClick={() => toReset && confirmReset(toReset)}>
              {reset.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </>
        }
      />

      <Dialog
        open={toErase !== null}
        onClose={() => setToErase(null)}
        title={`Erase the account of ${toErase?.name ?? ''}?`}
        description="Removes the contact person, email, mobile number, login and payment proofs. The club name and its dancers stay in published results. This can't be undone."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToErase(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={erase.isPending} onClick={() => toErase && confirmErase(toErase)}>
              {erase.isPending ? 'Erasing…' : 'Erase'}
            </Button>
          </>
        }
      />

      <Dialog
        open={clearing}
        onClose={() => setClearing(false)}
        title="Remove old payment proofs?"
        description="Deletes the receipt screenshots of competitions that ended more than 90 days ago. This also happens by itself every day."
        actions={
          <>
            <Button variant="ghost" onClick={() => setClearing(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={clear.isPending} onClick={confirmClear}>
              {clear.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      />

      <TempPasswordDialog title="Temporary password" person={shown?.person ?? ''} password={shown?.password ?? null} onClose={() => setShown(null)} />
    </div>
  )
}
