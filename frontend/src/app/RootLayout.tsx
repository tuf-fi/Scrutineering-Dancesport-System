import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { usingMocks } from '../api/mode.ts'
import { PopupHost } from '../components/PopupHost.tsx'
import { Toaster } from '../components/ui/index.ts'
import { PopupTestButton } from '../features/dev/PopupTestButton.tsx'
import { RoleSwitcher } from '../features/dev/RoleSwitcher.tsx'
import { useBrowserConnection, useRealtime } from '../hooks/index.ts'

// Every new page, and every reload, starts at the top
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export function RootLayout() {
  useBrowserConnection()
  useRealtime()
  return (
    <>
      <ScrollToTop />
      <Outlet />
      <Toaster />
      <PopupHost />
      {import.meta.env.DEV && <PopupTestButton />}
      {import.meta.env.DEV && usingMocks && <RoleSwitcher />}
    </>
  )
}
