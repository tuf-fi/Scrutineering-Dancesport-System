import { useState } from 'react'
import { PageHeader, Tabs } from '../../components/ui/index.ts'
import { AgeGroupsTab } from './AgeGroupsTab.tsx'
import { EventKindsTab } from './EventKindsTab.tsx'

const TABS = [
  { id: 'kinds', label: 'Event kinds' },
  { id: 'age-groups', label: 'Age groups' },
]

export function CategoriesPage() {
  const [tab, setTab] = useState('kinds')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kinds and age groups" description="The kinds of event and the age groups every competition's events are made from." />
      <Tabs label="View" items={TABS} value={tab} onChange={setTab} />
      {tab === 'kinds' ? <EventKindsTab /> : <AgeGroupsTab />}
    </div>
  )
}
