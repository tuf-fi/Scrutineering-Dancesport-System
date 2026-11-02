import { useId, type ReactNode } from 'react'

// One screen of the athlete's account: a small uppercase title, a short note, then the content
export function AccountSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="text-[1.25rem] font-bold uppercase leading-none tracking-[-0.01em] text-neutral-900">
          {title}
        </h2>
        {note && <p className="text-small text-neutral-600">{note}</p>}
      </div>
      {children}
    </section>
  )
}
