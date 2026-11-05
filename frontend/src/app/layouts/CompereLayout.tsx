import { Outlet } from 'react-router'
import { useAuth } from '../../stores/auth.ts'

// LED wall layout: the deep brown ground with one warm glow. The announcer's navbar is fixed on top (it fades when idle), and the
// sign-out lives in its account menu.
export function McLayout() {
  const user = useAuth((s) => s.user)
  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col bg-brown-950 bg-[radial-gradient(100vmin_70vmin_at_100%_0%,rgb(228_178_46/0.12),transparent_65%)] text-white">
      <main className="flex flex-1 flex-col p-[4.5vmin] pt-[calc(4.5vmin+3.5rem)]">
        <Outlet />
      </main>
    </div>
  )
}
