import { Outlet } from 'react-router'
import { Toaster } from '../components/ui/index.ts'
import { RoleSwitcher } from '../features/dev/RoleSwitcher.tsx'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <RoleSwitcher />}
    </>
  )
}
