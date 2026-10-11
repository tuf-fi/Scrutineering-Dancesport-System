import { Skeleton } from '../../components/ui/index.ts'
import { useCompetitions } from '../../hooks/index.ts'
import { formatDate } from '../../lib/format.ts'

// Dark panel naming the current competition; shown beside sign-in forms from laptop width
export function CompetitionPanel() {
  const { data: competitions } = useCompetitions()
  const current = competitions?.[0]

  return (
    <aside className="hidden flex-col justify-end gap-3 bg-brown-950 p-16 text-white lg:flex">
      {current ? (
        <>
          <p className="text-small text-brown-100">{formatDate(current.date)}</p>
          <h2 className="text-balance text-display font-semibold">{current.name}</h2>
          <p className="max-w-sm text-body text-brown-100">{current.venue}</p>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32 bg-brown-800!" />
          <Skeleton className="h-12 w-96 bg-brown-800!" />
          <Skeleton className="h-5 w-72 bg-brown-800!" />
        </div>
      )}
    </aside>
  )
}
