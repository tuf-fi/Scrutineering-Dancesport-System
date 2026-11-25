import {
  CERTIFICATE_FONTS,
  certificatePage,
  fillCertificateText,
  type CERTIFICATE_TOKENS,
  type CertificateLayout,
  type CertificateLineKey,
} from '@bis/shared'
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { CertificateSignature } from './certificateSignatures.ts'
import { SignLine, type SignParts } from './SignLine.tsx'

export type CertificateValues = Partial<Record<(typeof CERTIFICATE_TOKENS)[number], string>>

// A line is 'line:name', a signature block is 'sign:president', and its picture and printed name are 'picture:president' and 'name:president'
export type MoveTarget = `line:${CertificateLineKey}` | `sign:${string}` | `picture:${string}` | `name:${string}`

const HEADER: CertificateLineKey[] = ['organizer', 'title', 'competition']
const BODY: CertificateLineKey[] = ['certify', 'name', 'team', 'placed', 'place', 'grade']
const MM_PX = 96 / 25.4

// One certificate page, drawn from the layout. The printed page and the editor's preview both use it. In the editor every line
// and signature can be dragged (or nudged with the arrow keys) to where it should be.
export function CertificateSheet({ layout, values, signatures, date, label, pageBreak, selected, onSelect, onMove, zoom = 1 }: {
  layout: CertificateLayout
  values: CertificateValues
  signatures: CertificateSignature[]
  date: string
  label: string
  pageBreak?: boolean
  selected?: CertificateLineKey
  onSelect?: (key: CertificateLineKey) => void
  // Called with how far to move, in millimetres
  onMove?: (target: MoveTarget, dx: number, dy: number) => void
  // How much the sheet is shrunk on screen, so a drag in pixels becomes millimetres
  zoom?: number
}) {
  const page = certificatePage(layout)
  const last = useRef<{ x: number; y: number } | null>(null)

  const drag = (target: MoveTarget, select?: () => void) => {
    if (!onMove) return {}
    return {
      // Stopped here so dragging the picture or the name does not also drag the block around them
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        e.stopPropagation()
        select?.()
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = { x: e.clientX, y: e.clientY }
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        e.stopPropagation()
        if (!last.current) return
        onMove(target, (e.clientX - last.current.x) / zoom / MM_PX, (e.clientY - last.current.y) / zoom / MM_PX)
        last.current = { x: e.clientX, y: e.clientY }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        e.stopPropagation()
        last.current = null
      },
      onPointerCancel: (e: PointerEvent<HTMLElement>) => {
        e.stopPropagation()
        last.current = null
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        const step = e.shiftKey ? 5 : 1
        const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
        if (!move) return
        e.preventDefault()
        e.stopPropagation()
        onMove(target, move[0]!, move[1]!)
      },
      tabIndex: 0,
    }
  }
  const shift = (x: number, y: number): CSSProperties => (x || y ? { transform: `translate(${x}mm, ${y}mm)` } : {})
  const grab = 'cursor-grab touch-none rounded-sm outline-offset-4 transition-colors hover:bg-gold-50 active:cursor-grabbing'

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
        // A new line in the words (the second athlete of a couple) starts a new line on the certificate
        whiteSpace: 'pre-line',
        color: l.color,
        ...shift(l.x, l.y),
      }
      if (!onMove) {
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
          aria-label={`Move ${text}`}
          aria-pressed={selected === key}
          {...drag(`line:${key}`, () => onSelect?.(key))}
          className={`${grab} px-2 ${selected === key ? 'bg-gold-50 outline outline-2 outline-gold-500' : ''}`}
        >
          {text}
        </p>
      )
    })

  return (
    <article
      aria-label={label}
      data-pdf-page
      style={{ width: `${page.sheetWidth}mm`, height: `${page.sheetHeight}mm` }}
      className={`certificate-page relative flex mx-auto max-w-full flex-col justify-between overflow-hidden bg-white shadow-md px-[16mm] py-[9mm] text-neutral-900 ${pageBreak ? 'print-page-break' : ''}`}
    >
      {layout.background && <img src={layout.background} alt="" className="absolute inset-0 size-full object-cover" />}
      <header className="relative flex flex-col items-center gap-2 text-center">{lines(HEADER)}</header>
      <div className="relative flex flex-col items-center gap-3 text-center">{lines(BODY)}</div>
      <footer className="relative flex flex-col gap-4">
        <div className="flex flex-col items-center text-center">{lines(['venue'])}</div>
        <div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${Math.max(signatures.length, 1)}, minmax(0, 1fr))` }}>
          {signatures.map(({ id, role, signer, x, y, signX, signY, nameX, nameY }) => {
            // The picture and the name carry their own shift on top of the block's; in print they are plain
            const parts: SignParts = {
              signature: { style: shift(signX, signY), ...(onMove ? { role: 'button', 'aria-label': `Move the ${role} signature picture`, className: grab, ...drag(`picture:${id}`) } : {}) },
              name: { style: shift(nameX, nameY), ...(onMove ? { role: 'button', 'aria-label': `Move the ${role} name`, className: grab, ...drag(`name:${id}`) } : {}) },
            }
            return (
              <div
                key={id}
                style={shift(x, y)}
                {...(onMove ? { role: 'button', 'aria-label': `Move the ${role} signature block` } : {})}
                {...drag(`sign:${id}`)}
                className={onMove ? grab : ''}
              >
                <SignLine role={role} signer={signer} date={date} center plain parts={parts} />
              </div>
            )
          })}
        </div>
      </footer>
    </article>
  )
}
