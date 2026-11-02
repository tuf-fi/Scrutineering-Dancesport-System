import { Reveal } from '../../components/Reveal.tsx'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useUpcomingCompetitions } from '../../hooks/index.ts'
import { Hero } from './home/Hero.tsx'
import { HowToJoin } from './home/HowToJoin.tsx'
import { LatestCompetitions } from './home/LatestCompetitions.tsx'
import { UpcomingEvents } from './home/UpcomingEvents.tsx'

export function HomePage() {
  const upcoming = useUpcomingCompetitions()

  if (!upcoming) return <Skeleton className="h-80 w-full" />
  if (!upcoming.recent && upcoming.list.length === 0) return <ErrorState onRetry={() => window.location.reload()} />

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <Hero />
      <Reveal>
        <UpcomingEvents list={upcoming.list} upcoming={upcoming.upcoming} />
      </Reveal>
      <Reveal>
        <LatestCompetitions />
      </Reveal>
      <Reveal>
        <HowToJoin />
      </Reveal>
    </div>
  )
}
