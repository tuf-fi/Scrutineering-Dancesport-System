import { Outlet } from 'react-router'
import { usingMocks } from '../api/mode.ts'
import { Toaster } from '../components/ui/index.ts'
import { RoleSwitcher } from '../features/dev/RoleSwitcher.tsx'
import { useBrowserConnection, useRealtime } from '../hooks/index.ts'

export function RootLayout() {
  useBrowserConnection()
  useRealtime()
  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && usingMocks && <RoleSwitcher />}
    </>
  )
}
