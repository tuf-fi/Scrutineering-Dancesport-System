import { useEffect } from 'react'
import { useConnection } from '../stores/connection.ts'

// When the browser itself says the Wi-Fi went off (or came back), show it straight away instead of waiting for the next
// request to fail. A request that then succeeds or fails sets the state again, so a wrong guess is corrected at once.
export function useBrowserConnection() {
  const setOnline = useConnection((s) => s.setOnline)
  useEffect(() => {
    const off = () => setOnline(false)
    const on = () => setOnline(true)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [setOnline])
}
