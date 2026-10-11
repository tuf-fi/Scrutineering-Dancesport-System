import { EmptyState, PageHeader } from './ui/index.ts'

// TODO: stands in for screens that are built in later steps; replace each route's element
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={title} />
      <EmptyState title="Nothing here yet" description="This screen has not been built." />
    </div>
  )
}
