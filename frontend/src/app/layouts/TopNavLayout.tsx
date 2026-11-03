import { Role } from '@bis/shared'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { SignInChooser } from '../../components/SignInChooser.tsx'
import { Button } from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'
import { useAuth } from '../../stores/auth.ts'
import { publicNav, roleHome, type NavItem } from '../nav.ts'
import { useMyAthlete, useMyMember } from '../../hooks/index.ts'
import { useSignOut } from '../useSignOut.ts'
import { AccountMenu } from './AccountMenu.tsx'
import { NotificationBell } from './NotificationBell.tsx'
import { PublicMenu } from './PublicMenu.tsx'
import { SiteFooter } from './SiteFooter.tsx'

// The site navbar, shared by the public pages and the athlete's page
function TopNavLayout({ items, right }: { items: NavItem[]; right: ReactNode }) {
  const { pathname } = useLocation()
  // An account (athlete, coach or team) uses the whole width; the public pages stay in a reading column
  const wide = ['/athlete', '/coach', '/team'].some((base) => pathname === base || pathname.startsWith(`${base}/`))
  const header = useRef<HTMLElement>(null)

  // The account's sidebar is fixed under the navbar, so it needs the navbar's height
  useLayoutEffect(() => {
    const el = header.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(set)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header ref={header} className="sticky top-0 z-30 bg-black text-white">
        <div className={cn('mx-auto flex items-center gap-x-4 lg:gap-x-10 px-4 sm:px-8', wide ? 'max-w-none lg:px-12' : 'max-w-5xl')}>
          <Link to="/" aria-label="Home" className="py-1">
            <Brand size="md" plate={false} />
          </Link>
          <nav aria-label="Main" className="no-scrollbar hidden overflow-x-auto lg:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'mr-7 shrink-0 whitespace-nowrap border-b-2 py-4 text-small font-semibold transition-colors last:mr-0',
                    isActive || item.also?.some((p) => pathname.startsWith(p)) ? 'border-gold-400 text-white' : 'border-transparent text-white/60 hover:text-white',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {right}
            <PublicMenu items={items} />
          </div>
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-8 sm:py-14', wide ? 'max-w-none lg:px-12' : 'max-w-5xl')}>
        <Outlet />
      </main>
      {!wide && <SiteFooter />}
    </div>
  )
}

// Right side of the navbar: the signed-in athlete, a link back to staff screens, or the athlete sign-in
function Account() {
  const user = useAuth((s) => s.user)
  const signOut = useSignOut(user?.role === Role.Coach ? '/coach/sign-in' : user?.role === Role.Team ? '/team/sign-in' : '/athlete/sign-in')
  const photo = useMyAthlete().data?.profile.photo
  const memberPhoto = useMyMember().data?.photo

  const [choosing, setChoosing] = useState(false)

  if (!user) {
    return (
      <>
        <Button size="sm" className="max-lg:hidden" onClick={() => setChoosing(true)}>
          Sign in
        </Button>
        <SignInChooser open={choosing} onClose={() => setChoosing(false)} />
      </>
    )
  }
  if (user.role === Role.Coach || user.role === Role.Team) {
    return (
      <>
        <NotificationBell />
        <AccountMenu name={user.name} photo={memberPhoto} detail={user.role === Role.Team ? 'Team' : 'Coach'} profile={{ to: roleHome[user.role], label: 'My page' }} onSignOut={signOut} />
      </>
    )
  }
  if (user.role !== Role.Athlete) {
    return (
      <Link to={roleHome[user.role]} className="text-small font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
        Dashboard
      </Link>
    )
  }
  return (
    <>
      <NotificationBell />
      <AccountMenu name={user.name} photo={photo} profile={{ to: '/athlete', label: 'Athlete profile' }} onSignOut={signOut} />
    </>
  )
}

export function PublicLayout() {
  return <TopNavLayout items={publicNav} right={<Account />} />
}
