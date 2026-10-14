import { Role } from '@bis/shared'
import { useBackupStatus } from '../hooks/index.ts'
import { useAuth } from '../stores/auth.ts'

// Tells the scrutineer or admin when a backup folder (the USB drive, Laptop 3) cannot be written.
// The competition carries on; this only says the copy on that device is out of date.
export function BackupNotice() {
  const role = useAuth((s) => s.user?.role)
  const { data } = useBackupStatus(role === Role.Scrutineer || role === Role.Admin)
  const failing = data?.targets.filter((t) => !t.ok) ?? []
  if (failing.length === 0) return null

  return (
    <div role="alert" className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-small text-neutral-900 sm:px-8 lg:px-12">
      <p className="font-semibold">
        {failing.length === 1 ? 'One backup folder' : `${failing.length} backup folders`} cannot be reached
      </p>
      <p className="text-neutral-700">
        Results are still saved on this laptop.{' '}
        {failing.map((t) => (
          <span key={t.path} className="mr-3 whitespace-nowrap">
            <span className="font-mono">{t.path}</span>
          </span>
        ))}
        Plug the drive back in or check the network.
      </p>
    </div>
  )
}
