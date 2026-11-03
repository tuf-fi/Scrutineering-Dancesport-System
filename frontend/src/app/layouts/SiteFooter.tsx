import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '../../components/Brand.tsx'
import { useUpcomingCompetitions } from '../../hooks/index.ts'
import { formatDate } from '../../lib/format.ts'
import { publicNav } from '../nav.ts'

const linkClass = 'text-small text-white/70 transition-colors hover:text-gold-300'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-gold-300">{title}</h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  )
}

// The site footer: who we are, where to go, the athlete's way in, and the next event
export function SiteFooter() {
  const next = useUpcomingCompetitions()?.list[0]

  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 pt-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          <div className="flex flex-col gap-5">
            <Brand size="xl" plate={false} className="self-start" />
            <p className="max-w-[16rem] text-small leading-[1.6] text-white/60">Scoring and results for dancesport competitions across Bicol.</p>
          </div>
          <Column title="Explore">
            {publicNav.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </Column>
          <Column title="Athletes">
            <li>
              <Link to="/sign-in" className={linkClass}>
                Sign in or create an account
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={linkClass}>
                Privacy
              </Link>
            </li>
          </Column>
          {next && (
            <Column title="Next event">
              <li className="text-body font-semibold leading-[1.3] text-white">{next.name}</li>
              <li className="text-small text-white/60">
                {formatDate(next.date)}
                <br />
                {next.venue}
              </li>
              <li>
                <Link to={`/competitions/${next.id}`} className={linkClass}>
                  View the event <span aria-hidden>→</span>
                </Link>
              </li>
            </Column>
          )}
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/15 py-6 font-mono text-xs uppercase tracking-[0.08em] text-white/50">
          <span>© {new Date().getFullYear()} Bicol Oragon Scruteneering System</span>
          <span>Integrity | Precision | Excellence</span>
        </div>
      </div>
    </footer>
  )
}
