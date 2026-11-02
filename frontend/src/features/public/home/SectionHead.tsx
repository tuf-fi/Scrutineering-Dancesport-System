import type { ReactNode } from 'react'
import { Link } from 'react-router'

// The title row every home section opens with: a title, an optional note, and a link on the right
export function SectionHead({ title, note, to, linkLabel }: { title: string; note?: ReactNode; to?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-neutral-900 pb-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[clamp(1.25rem,1rem+1.1vw,1.75rem)] font-bold uppercase leading-none tracking-[-0.02em] text-neutral-900">{title}</h2>
        {note && <p className="text-small text-neutral-600">{note}</p>}
      </div>
      {to && (
        <Link to={to} className="group shrink-0 text-small font-semibold text-neutral-900 underline decoration-gold-500 decoration-2 underline-offset-4">
          {linkLabel} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  )
}
