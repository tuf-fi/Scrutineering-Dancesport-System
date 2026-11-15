import { useState } from 'react'
import { EmptyState, PageHeader } from '../../components/ui/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { PanelsTab } from '../admin/PanelsTab.tsx'

// Who marks each event, for the secretariat and the scrutineer; the admin has the same grid beside the PINs
export function PanelsPage() {
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Panels" description="Which adjudicators mark each event. An event that has started keeps its panel." />
      {competitionId ? (
        <PanelsTab competitionId={competitionId} competitions={list} onCompetitionChange={setChosen} />
      ) : (
        <EmptyState title="No competition yet" description="Once a competition exists, choose each event's panel here." />
      )}
    </div>
  )
}
