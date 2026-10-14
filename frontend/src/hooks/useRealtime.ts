import { useQueryClient } from '@tanstack/react-query'
import { Role } from '@bis/shared'
import { useEffect } from 'react'
import { onReachability, onSessionEnded } from '../api/http.ts'
import { usingMocks } from '../api/mode.ts'
import { connectRealtime } from '../api/realtime.ts'
import { useAuth } from '../stores/auth.ts'
import { useConnection } from '../stores/connection.ts'

// Many changes can arrive at once (ten phones submitting); refetch once they settle
const SETTLE_MS = 300

// Keeps the screens in step with the venue server: connects the socket, refetches when something changes,
// reports whether the server can be reached, and sends the phone's heartbeat
export function useRealtime() {
  const queryClient = useQueryClient()
  const userId = useAuth((s) => s.user?.id ?? null)
  const role = useAuth((s) => s.user?.role ?? null)
  const signOut = useAuth((s) => s.signOut)
  const setOnline = useConnection((s) => s.setOnline)

  useEffect(() => {
    if (usingMocks) return
    onReachability(setOnline)
    onSessionEnded(() => {
      signOut()
      queryClient.clear()
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = connectRealtime({
      heartbeat: role === Role.Adjudicator,
      onConnect: () => {
        setOnline(true)
        void queryClient.invalidateQueries()
      },
      onDisconnect: () => setOnline(false),
      onChange: () => {
        clearTimeout(timer)
        timer = setTimeout(() => void queryClient.invalidateQueries(), SETTLE_MS)
      },
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
    // A new sign-in needs a new socket, because the server decides what to send from the cookie it opens with
  }, [userId, role, queryClient, setOnline, signOut])
}
