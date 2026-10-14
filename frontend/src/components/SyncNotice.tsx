import { Role } from '@bis/shared'
import { useSyncStatus } from '../hooks/index.ts'
import { useAuth } from '../stores/auth.ts'

// Tells staff when results are waiting to go to the cloud and it cannot be reached.
// The competition carries on; the changes are kept here and sent when it is back.
export function SyncNotice() {
  const role = useAuth((s) => s.user?.role)
  const { data } = useSyncStatus(role === Role.Scrutineer || role === Role.Admin || role === Role.Secretariat)
  if (!data?.enabled || data.pending === 0 || data.reachable !== false) return null

  return (
    <div role="alert" className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-small text-neutral-900 sm:px-8 lg:px-12">
      <p className="font-semibold">The cloud cannot be reached</p>
      <p className="text-neutral-700">
        {data.pending} {data.pending === 1 ? 'change is' : 'changes are'} saved on this laptop and will be sent when the connection is back.
      </p>
    </div>
  )
}
