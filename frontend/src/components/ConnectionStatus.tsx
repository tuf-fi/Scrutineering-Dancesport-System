import { usingMocks } from '../api/mode.ts'
import { useConnection } from '../stores/connection.ts'
import { Badge } from './ui/index.ts'

// Shows whether this device can reach the venue server. In the sample app, clicking flips it so offline screens can be reviewed.
export function ConnectionStatus() {
  const { online, toggle } = useConnection()
  const badge = (
    <Badge tone={online ? 'success' : 'warning'} dot>
      {online ? 'Online' : 'Offline'}
    </Badge>
  )
  if (!usingMocks) {
    return (
      <span role="status" aria-label={online ? 'Connected to the venue server' : 'Cannot reach the venue server'}>
        {badge}
      </span>
    )
  }
  return (
    <button
      onClick={toggle}
      aria-pressed={!online}
      aria-label={online ? 'Online. Switch to offline' : 'Offline. Switch to online'}
      className="rounded-sm"
    >
      {badge}
    </button>
  )
}
