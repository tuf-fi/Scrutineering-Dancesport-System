import type { StaffUser } from '@bis/shared'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatars } from '../../components/Avatars.tsx'
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  PageHeader,
  SearchField,
  Select,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import { useDeleteStaff, useResetStaffPassword, useStaffUsers } from '../../hooks/index.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { STAFF_ROLES } from './constants.ts'
import { StaffDialog } from './StaffDialog.tsx'
import { TempPasswordDialog } from './TempPasswordDialog.tsx'

export function StaffPage() {
  const staff = useStaffUsers()
  const reset = useResetStaffPassword()
  const remove = useDeleteStaff()
  const me = useAuth((s) => s.user)
  const [role, setRole] = useState('all')
  const [query, setQuery] = useState('')
  // The account being edited, or 'new' while adding one
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null)
  const [confirmReset, setConfirmReset] = useState<StaffUser | null>(null)
  const [toDelete, setToDelete] = useState<StaffUser | null>(null)
  const [shown, setShown] = useState<{ title: string; person: string; password: string } | null>(null)

  if (staff.isError) return <ErrorState onRetry={() => void staff.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (staff.data ?? []).filter(
    (s) =>
      (role === 'all' || s.role === role) &&
      (!needle || s.name.toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle)),
  )

  function doReset(user: StaffUser) {
    reset.mutate(user.id, {
      onSuccess: (r) => {
        setConfirmReset(null)
        setShown({ title: 'Password reset', person: user.name, password: r.tempPassword })
      },
      onError: (e) => {
        setConfirmReset(null)
        toast.error(e.message)
      },
    })
  }

  function doDelete(user: StaffUser) {
    remove.mutate(user.id, {
      onSuccess: () => {
        setToDelete(null)
        toast.success(`Deleted ${user.name}`)
      },
      onError: (e) => {
        setToDelete(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff accounts" description="Who can sign in, and what each person can do." />

      <Toolbar>
        <SearchField className="w-full sm:w-72" value={query} onChange={setQuery} />
        <div className="w-full sm:w-56">
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarActions>
          <Button className="w-full sm:w-auto" onClick={() => setEditing('new')}>
            Add account
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<StaffUser>
        loading={staff.isLoading}
        rows={rows}
        rowKey={(s) => s.id}
        minWidthClass="min-w-0"
        paginationLabel="Staff pagination"
        detailTitle={(u) => u.name}
        empty={
          needle || role !== 'all'
            ? { title: 'No accounts match', description: 'Try a different role or name.' }
            : { title: 'No staff accounts' }
        }
        columns={[
          {
            key: 'name',
            header: 'Account',
            cell: (s) => (
              <div className="flex items-center gap-3">
                <Avatars names={[s.name]} />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-neutral-900">
                    {s.name}
                    {s.id === me?.id && <span className="ml-2 font-normal text-neutral-500">You</span>}
                  </span>
                  <span className="font-mono text-xs text-neutral-600">{s.username}</span>
                </div>
              </div>
            ),
          },
          { key: 'role', header: 'Role', cell: (s) => ROLE_LABEL[s.role], muted: true },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-32',
            cell: (s) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} label={`Edit ${s.name}`} onClick={() => setEditing(s)} />
                <IconButton icon={KeyRound} label={`Reset password for ${s.name}`} onClick={() => setConfirmReset(s)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${s.name}`} onClick={() => setToDelete(s)} />
              </div>
            ),
          },
        ]}
      />

      <StaffDialog
        open={editing !== null}
        user={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onCreated={(person, password) => setShown({ title: 'Account created', person, password })}
      />

      <Dialog
        open={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        title={`Reset ${confirmReset?.name ?? ''}'s password?`}
        description="Their current password stops working. You'll get a temporary one to pass on."
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reset.isPending}
              onClick={() => confirmReset && doReset(confirmReset)}
            >
              Reset password
            </Button>
          </>
        }
      />

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="They can no longer sign in. This can't be undone."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => toDelete && doDelete(toDelete)}>
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />

      <TempPasswordDialog
        title={shown?.title ?? ''}
        person={shown?.person ?? ''}
        password={shown?.password ?? null}
        onClose={() => setShown(null)}
      />
    </div>
  )
}
