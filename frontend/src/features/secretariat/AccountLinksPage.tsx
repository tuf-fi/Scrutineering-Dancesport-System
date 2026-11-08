import type { MemberClaimRow } from '@bis/shared'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, ErrorState, IconButton, PageHeader, SearchField, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useApproveMemberClaim, useMemberClaims, useRejectMemberClaim } from '../../hooks/index.ts'

// Coach, team and athlete accounts asking to be linked to their coach or team record
export function AccountLinksPage() {
  const claims = useMemberClaims()
  const approve = useApproveMemberClaim()
  const reject = useRejectMemberClaim()
  const [query, setQuery] = useState('')

  if (claims.isError) return <ErrorState onRetry={() => void claims.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (claims.data ?? []).filter((c) => !needle || [c.name, c.email, c.targetName].some((v) => v.toLowerCase().includes(needle)))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account links" description="Coach, team and athlete accounts asking to be linked to their record. Linking lets coaches and teams see their dancers, and fills in an athlete’s details." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search requests" value={query} onChange={setQuery} />
      </Toolbar>

      <Table<MemberClaimRow>
        loading={claims.isLoading}
        rows={rows}
        rowKey={(c) => c.memberId}
        minWidthClass="min-w-0"
        paginationLabel="Account links pagination"
        empty={needle ? { title: 'No requests match', description: 'Try a different name.' } : { title: 'Nothing waiting', description: 'Requests appear here when a coach, team or athlete asks to be linked.' }}
        columns={[
          { key: 'name', header: 'Account', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'kind', header: 'Type', hideBelow: 'sm', cell: (c) => <Badge pill tone="neutral">{c.role === 'team' ? 'Team' : c.role === 'athlete' ? 'Athlete' : 'Coach'}</Badge> },
          { key: 'email', header: 'Email', muted: true, hideBelow: 'md', cell: (c) => c.email },
          { key: 'target', header: 'Wants to be', cell: (c) => c.targetName },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (c) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={Check}
                  label={`Link ${c.name} to ${c.targetName}`}
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(c.memberId, { onSuccess: () => toast.success(`Linked ${c.name}`), onError: (e) => toast.error(e.message) })}
                />
                <IconButton
                  icon={X}
                  tone="danger"
                  label={`Turn down the request of ${c.name}`}
                  disabled={reject.isPending}
                  onClick={() => reject.mutate(c.memberId, { onSuccess: () => toast.success('Request turned down'), onError: (e) => toast.error(e.message) })}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
