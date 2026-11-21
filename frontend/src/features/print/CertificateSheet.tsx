import { CERTIFICATE_FONTS, certificatePage, fillCertificateText, type CertificateLayout, type CertificateLineKey, CERTIFICATE_TOKENS } from '@bis/shared'
import type { CSSProperties } from 'react'
import { SignLine } from './SignLine.tsx'
import { SIGNERS, type Signers } from './signers.ts'

export type CertificateValues = Partial<Record<(typeof CERTIFICATE_TOKENS)[number], string>>

const HEADER: CertificateLineKey[] = ['organizer', 'title', 'competition']
const BODY: CertificateLineKey[] = ['certify', 'name', 'team', 'placed', 'place', 'event', 'grade', 'number']

// One certificate page, drawn from the layout. The printed page and the editor's preview both use it.
export function CertificateSheet({ layout, values, signers, date, label, pageBreak, selected, onSelect }: {
  layout: CertificateLayout
  values: CertificateValues
  signers: Signers
  date: string
  label: string
  pageBreak?: boolean
  // The editor's preview lets a line be picked by clicking it
  selected?: CertificateLineKey
  onSelect?: (key: CertificateLineKey) => void
}) {
  const page = certificatePage(layout)
  const lines = (keys: CertificateLineKey[]) =>
    keys.map((key) => {
      const l = layout.lines[key]
      const text = fillCertificateText(l.text, values)
      if (!text) return null
      const style: CSSProperties = {
        fontFamily: CERTIFICATE_FONTS[l.font].stack,
        fontSize: `${l.size}pt`,
        fontWeight: l.bold ? 700 : 400,
        fontStyle: l.italic ? 'italic' : 'normal',
        textTransform: l.uppercase ? 'uppercase' : 'none',
        lineHeight: 1.2,
      }
      if (!onSelect) {
        return (
          <p key={key} style={style}>
            {text}
          </p>
        )
      }
      return (
        <p
          key={key}
          style={style}
          role="button"
          tabIndex={0}
          aria-pressed={selected === key}
          onClick={() => onSelect(key)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(key)}
          className={`cursor-pointer rounded-sm px-2 outline-offset-4 transition-colors hover:bg-gold-50 ${selected === key ? 'bg-gold-50 outline outline-2 outline-gold-500' : ''}`}
        >
          {text}
        </p>
      )
    })

  return (
    <article
      aria-label={label}
      style={{ width: `${page.sheetWidth}mm`, height: `${page.sheetHeight}mm` }}
      className={`certificate-page relative flex mx-auto max-w-full flex-col justify-between overflow-hidden border border-neutral-900 px-[16mm] py-[9mm] text-neutral-900 ${pageBreak ? 'print-page-break' : ''}`}
    >
      {layout.background && <img src={layout.background} alt="" className="absolute inset-0 size-full object-cover" />}
      <header className="relative flex flex-col items-center gap-2 text-center">{lines(HEADER)}</header>
      <div className="relative flex flex-col items-center gap-3 text-center">{lines(BODY)}</div>
      <footer className="relative flex flex-col gap-4">
        <div className="text-center">{lines(['venue'])}</div>
        <div className="grid grid-cols-2 gap-16">
          {SIGNERS.map(({ key, role }) => (
            <SignLine key={key} role={role} signer={signers[key]} date={date} center />
          ))}
        </div>
      </footer>
    </article>
  )
}
