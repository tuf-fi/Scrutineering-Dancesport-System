import type { Team } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { EmptyState, Skeleton } from '../../components/ui/index.ts'
import { useCompetitorRows } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'

const SHOWN = 8

// The competitors of a team, with a link to the full list filtered to it
export function TeamMembers({ team, section }: { team: Team; section: string }) {
  const competitors = useCompetitorRows()
  const members = (competitors.data ?? []).filter((c) => c.teamId === team.id)

  return (
    <section aria-label="Competitors" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-mono text-xs uppercase text-neutral-500">Competitors ({members.length})</h3>
        {members.length > 0 && (
          <Link to={`${section}/competitors?team=${team.id}`} className="group flex items-center gap-1 text-small font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-gold-500">
            Open the list
            <ArrowUpRight aria-hidden className="size-4 text-neutral-500 transition duration-300 group-hover:rotate-45 group-hover:text-gold-500" strokeWidth={1.75} />
          </Link>
        )}
      </div>
      {competitors.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : members.length === 0 ? (
        <EmptyState title="No competitors yet" description="Competitors entered under this team appear here." />
      ) : (
        <ul className="border-y border-neutral-200">
          {members.slice(0, SHOWN).map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-neutral-200 py-2.5 first:border-t-0">
              <Avatars names={c.names} />
              <span className="min-w-0 flex-1 truncate text-small font-medium text-neutral-900">{competitorName(c.names)}</span>
              <span className="font-mono text-xs tabular-nums text-neutral-500">{c.backNumber ?? '–'}</span>
            </li>
          ))}
        </ul>
      )}
      {members.length > SHOWN && <p className="text-small text-neutral-500">and {members.length - SHOWN} more</p>}
    </section>
  )
}
