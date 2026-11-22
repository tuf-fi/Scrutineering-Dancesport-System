import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { usingMocks } from '../api/mode.ts'
import { PopupHost } from '../components/PopupHost.tsx'
import { Toaster } from '../components/ui/index.ts'
import { PopupTestButton } from '../features/dev/PopupTestButton.tsx'
import { RoleSwitcher } from '../features/dev/RoleSwitcher.tsx'
import { useBrowserConnection, useDocumentTitle, useRealtime } from '../hooks/index.ts'
import { STAFF_SIGN_IN } from './nav.ts'

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

// The page names for the browser tab. Pages for one competition or dancer set their own; null here leaves theirs alone.
const TITLES: Record<string, string | null> = {
  '/': '',
  '/competitions': 'Competitions',
  '/results': 'Results',
  '/live': 'Live now',
  '/athletes': 'Dancers',
  '/standings': 'Standings',
  '/rankings': 'Standings',
  '/privacy': 'Privacy',
  '/login': 'Sign in',
  [STAFF_SIGN_IN]: 'Staff sign in',
  '/adjudicator': 'Adjudicator sign in',
}
const SECTIONS: Array<[string, string]> = [
  ['/admin', 'Admin'],
  ['/secretariat', 'Secretariat'],
  ['/scrutineer', 'Scrutineer'],
  ['/compere', 'Compere'],
  ['/barker', 'Barker'],
  ['/print', 'Print'],
  ['/adjudicator', 'Adjudicator'],
  ['/athlete', 'My account'],
  ['/coach', 'My account'],
  ['/team', 'My account'],
  ['/account', 'My account'],
  ['/notifications', 'Notifications'],
]
const OWN_TITLE = /^\/(competitions|results|live|competitors)\/[^/]/

function titleFor(pathname: string): string | null | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path in TITLES) return TITLES[path]
  if (OWN_TITLE.test(path)) return undefined
  return SECTIONS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1]
}

export function RootLayout() {
  useBrowserConnection()
  useRealtime()
  useDocumentTitle(titleFor(useLocation().pathname))
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
