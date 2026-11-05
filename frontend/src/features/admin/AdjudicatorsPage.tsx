import { useState } from 'react'
import { EmptyState, PageHeader, Tabs } from '../../components/ui/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { AdjudicatorsTab } from './AdjudicatorsTab.tsx'
import { PanelsTab } from './PanelsTab.tsx'

const TABS = [
  { id: 'adjudicators', label: 'Adjudicators' },
  { id: 'panels', label: 'Panels' },
]

export function AdjudicatorsPage() {
  const [tab, setTab] = useState('adjudicators')
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Adjudicators and panels"
        description="Who adjudicates, their PINs for a competition, and which panel marks each event."
      />
      <Tabs label="View" items={TABS} value={tab} onChange={setTab} />
      {tab === 'adjudicators' ? (
        // Adjudicators can be added before there is a competition; only their PINs need one
        <AdjudicatorsTab competitionId={competitionId ?? ''} competitions={list} onCompetitionChange={setChosen} />
      ) : competitionId ? (
        <PanelsTab competitionId={competitionId} competitions={list} onCompetitionChange={setChosen} />
      ) : (
        <EmptyState title="No competition yet" description="Create a competition first, then choose each event's panel here." />
      )}
    </div>
  )
}
