import { CalendarDays } from 'lucide-react'

export function EmptyNote({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-dashed border-neutral-300 p-6">
      <CalendarDays aria-hidden className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-neutral-900">{title}</p>
        <p className="text-small text-neutral-600">{description}</p>
      </div>
    </div>
  )
}
