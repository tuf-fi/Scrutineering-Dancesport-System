import { useConnection } from '../stores/connection.ts'
import { Badge } from './ui/index.ts'

// Shows the venue connection state; clicking flips it so offline screens can be reviewed
export function ConnectionStatus() {
  const { online, toggle } = useConnection()
  return (
    <button
      onClick={toggle}
      aria-pressed={!online}
      aria-label={online ? 'Online. Switch to offline' : 'Offline. Switch to online'}
      className="rounded-sm"
    >
      <Badge tone={online ? 'success' : 'warning'} dot>
        {online ? 'Online' : 'Offline'}
      </Badge>
    </button>
  )
}
