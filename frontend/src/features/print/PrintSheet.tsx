import type { Competition, Event } from '@bis/shared'
import type { ReactNode } from 'react'
import { AGE_GROUP_LABEL, AGE_GROUP_SHORT, DISCIPLINE_LABEL, eventDances } from '../../lib/format.ts'

// "10/Oct/2026", as on the paper result sheets
function sheetDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return `${String(d.getDate()).padStart(2, '0')}/${d.toLocaleDateString('en-GB', { month: 'short' })}/${d.getFullYear()}`
}

function Fields({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="relative flex flex-col gap-0.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[4.6rem_1fr] gap-x-2">
          <dt>{label}:</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface PrintSheetProps {
  title: string
  event: Event
  competition: Competition
  // The adjudicators on the panel, listed under the header as "B) NAME"
  adjudicators?: Array<{ letter: string; name: string }>
  children: ReactNode
  footer?: ReactNode
}

// The frame every printed sheet shares: a heavy title band, the event details with its number
// as a grey watermark, the panel, then the body. Modelled on the paper "Qualified Solos" sheet.
export function PrintSheet({ title, event, competition, adjudicators = [], children, footer }: PrintSheetProps) {
  return (
    <article className="relative border-2 border-neutral-900 text-[10pt] leading-snug text-neutral-900">
      <h1 className="print-exact border-b-2 border-neutral-900 bg-neutral-200 px-3 py-1.5 text-[15pt] font-bold">{title}</h1>

      <div className="relative grid grid-cols-2 gap-x-6 border-b-2 border-neutral-900 px-3 py-2.5">
        <span
          aria-hidden
          className="print-exact pointer-events-none absolute inset-0 grid select-none place-items-center text-[60pt] font-bold leading-none text-neutral-200"
        >
          E{event.number}
        </span>
        <Fields
          rows={[
            ['Date', sheetDate(competition.date)],
            ['Location', competition.venue],
            ['Organizer', competition.organizer],
            // TODO: the executor is the scrutineer's team; the sample reuses the organizer
            ['Executor', competition.organizer],
          ]}
        />
        <Fields
          rows={[
            ['Grade', `${AGE_GROUP_SHORT[event.ageGroup]} - ${event.class} [${eventDances(event)}]`],
            ['Age group', AGE_GROUP_LABEL[event.ageGroup]],
            ['Class', event.class],
            ['Discipline', DISCIPLINE_LABEL[event.discipline]],
          ]}
        />
      </div>

      {adjudicators.length > 0 && (
        <ul
          aria-label="Adjudicators"
          className="grid grid-cols-3 gap-x-4 gap-y-0.5 border-b-2 border-neutral-900 px-3 py-2 font-medium uppercase"
        >
          {adjudicators.map((a) => (
            <li key={a.letter}>
              {a.letter}) {a.name}
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto px-3 py-3 print:overflow-visible">{children}</div>
      {footer && <footer className="px-3 pb-3 pt-1 font-semibold">{footer}</footer>}
    </article>
  )
}
