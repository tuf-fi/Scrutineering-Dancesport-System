import { Outlet } from 'react-router'
import { usingMocks } from '../api/mode.ts'
import { PopupHost } from '../components/PopupHost.tsx'
import { Toaster } from '../components/ui/index.ts'
import { PopupTestButton } from '../features/dev/PopupTestButton.tsx'
import { RoleSwitcher } from '../features/dev/RoleSwitcher.tsx'
import { useBrowserConnection, useRealtime } from '../hooks/index.ts'

export function RootLayout() {
  useBrowserConnection()
  useRealtime()
  return (
    <>
      <Outlet />
      <Toaster />
      <PopupHost />
      {import.meta.env.DEV && <PopupTestButton />}
      {import.meta.env.DEV && usingMocks && <RoleSwitcher />}
    </>
  )
}
