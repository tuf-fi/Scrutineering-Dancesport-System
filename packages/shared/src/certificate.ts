// The look of a certificate: one layout for every competition, edited by the scrutineer or the admin.
export const CERTIFICATE_FONTS = {
  sans: { label: 'Sans serif', stack: "'Manrope Variable', system-ui, sans-serif" },
  serif: { label: 'Serif', stack: "Georgia, 'Times New Roman', serif" },
  script: { label: 'Script', stack: "'Brush Script MT', 'Segoe Script', cursive" },
  mono: { label: 'Monospace', stack: "'JetBrains Mono Variable', ui-monospace, monospace" },
} as const

export type CertificateFont = keyof typeof CERTIFICATE_FONTS
export type CertificateOrientation = 'landscape' | 'portrait'

// Portrait sizes in millimetres
export const CERTIFICATE_PAPER = {
  a4: { label: 'A4', width: 210, height: 297 },
  a3: { label: 'A3', width: 297, height: 420 },
  a5: { label: 'A5', width: 148, height: 210 },
  letter: { label: 'Letter', width: 215.9, height: 279.4 },
  legal: { label: 'Legal', width: 215.9, height: 355.6 },
} as const
export type CertificatePaper = keyof typeof CERTIFICATE_PAPER

export const CERTIFICATE_MARGIN_MM = 12

// The paper as it is printed, and the sheet drawn inside its margins (a little short, so it never spills onto a second page)
export function certificatePage(layout: Pick<CertificateLayout, 'paper' | 'orientation'>) {
  const p = CERTIFICATE_PAPER[layout.paper]
  const landscape = layout.orientation === 'landscape'
  const width = landscape ? p.height : p.width
  const height = landscape ? p.width : p.height
  return { width, height, sheetWidth: width - CERTIFICATE_MARGIN_MM * 2, sheetHeight: height - CERTIFICATE_MARGIN_MM * 2 - 2 }
}

export const CERTIFICATE_LINE_KEYS = ['organizer', 'title', 'competition', 'certify', 'name', 'team', 'placed', 'place', 'grade', 'venue'] as const
export type CertificateLineKey = (typeof CERTIFICATE_LINE_KEYS)[number]

// Words in braces are filled in for each finalist: {organizer} {competition} {name} {team} {place} {event} {grade} {number} {venue} {date}
export const CERTIFICATE_TOKENS = ['organizer', 'competition', 'name', 'team', 'place', 'event', 'grade', 'number', 'venue', 'date'] as const

export interface CertificateLine {
  text: string
  font: CertificateFont
  size: number
  bold: boolean
  italic: boolean
  uppercase: boolean
  // #rrggbb
  color: string
  // Moved from its place in the flow, in millimetres, by dragging it in the editor
  x: number
  y: number
}

// Who signs: any number of people, in the order they print. The organizer's name falls back to the competition's organizer and the
// chairperson's name and signature to the ones saved on their account; anyone else is only what is typed here.
export type CertificateSignatoryKind = 'organizer' | 'chairperson' | 'person'
export const MAX_CERTIFICATE_SIGNATORIES = 6

export interface CertificateSignatory {
  id: string
  kind: CertificateSignatoryKind
  // The words printed under the signature, for example "Organizer"
  title: string
  // Empty for the organizer means the competition's organizer
  name: string
  // A small PNG data URL; null prints an empty line to sign by hand
  signature: string | null
  // The whole block moved from its place, in millimetres
  x: number
  y: number
  // The signature picture and the printed name moved further, on their own, inside the block
  signX: number
  signY: number
  nameX: number
  nameY: number
}

export interface CertificateLayout {
  paper: CertificatePaper
  orientation: CertificateOrientation
  // A picture printed behind the text (border, logo), as a data URL; null for none
  background: string | null
  lines: Record<CertificateLineKey, CertificateLine>
  signatories: CertificateSignatory[]
}

// How far an element may be dragged from its place, in millimetres
export const MAX_CERTIFICATE_OFFSET = 300
export const MAX_CERTIFICATE_SIGNATURE = 140_000
export const SIGNATURE_PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/
export const DEFAULT_CERTIFICATE_COLOR = '#171412'

export const CERTIFICATE_SIZE_RANGE = { min: 6, max: 72 } as const
export const MAX_CERTIFICATE_TEXT = 200
export const MAX_CERTIFICATE_BACKGROUND = 1_500_000

const line = (text: string, size: number, o: Partial<CertificateLine> = {}): CertificateLine => ({ text, font: 'sans', size, bold: false, italic: false, uppercase: false, color: DEFAULT_CERTIFICATE_COLOR, x: 0, y: 0, ...o })

export const blankSignatory = (id: string, kind: CertificateSignatoryKind, title = ''): CertificateSignatory => ({ id, kind, title, name: '', signature: null, x: 0, y: 0, signX: 0, signY: 0, nameX: 0, nameY: 0 })

const DEFAULT_SIGNATORIES = (): CertificateSignatory[] => [
  blankSignatory('organizer', 'organizer', 'Organizer'),
  blankSignatory('chairperson', 'chairperson', 'Chairperson of Adjudicators'),
  blankSignatory('president', 'person', 'PDSF President'),
]

export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  paper: 'a4',
  orientation: 'landscape',
  background: null,
  lines: {
    organizer: line('{organizer}', 10, { bold: true, uppercase: true }),
    title: line('Certificate', 26, { bold: true }),
    competition: line('{competition}', 11),
    certify: line('This is to certify that', 12),
    name: line('{name}', 24, { bold: true, uppercase: true }),
    team: line('{team}', 13),
    placed: line('placed', 12),
    place: line('{place}', 30, { bold: true }),
    grade: line('{grade}', 11),
    venue: line('{venue}, {date}', 10),
  },
  signatories: DEFAULT_SIGNATORIES(),
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const offset = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Math.min(MAX_CERTIFICATE_OFFSET, Math.max(-MAX_CERTIFICATE_OFFSET, Number(v))) * 10) / 10 : 0)

function cleanLine(input: unknown, fallback: CertificateLine): CertificateLine {
  if (!isObject(input)) return fallback
  const size = Number(input.size)
  return {
    text: typeof input.text === 'string' ? input.text.slice(0, MAX_CERTIFICATE_TEXT) : fallback.text,
    font: typeof input.font === 'string' && input.font in CERTIFICATE_FONTS ? (input.font as CertificateFont) : fallback.font,
    size: Number.isFinite(size) ? Math.min(CERTIFICATE_SIZE_RANGE.max, Math.max(CERTIFICATE_SIZE_RANGE.min, Math.round(size))) : fallback.size,
    bold: typeof input.bold === 'boolean' ? input.bold : fallback.bold,
    italic: typeof input.italic === 'boolean' ? input.italic : fallback.italic,
    uppercase: typeof input.uppercase === 'boolean' ? input.uppercase : fallback.uppercase,
    color: typeof input.color === 'string' && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : fallback.color,
    x: offset(input.x),
    y: offset(input.y),
  }
}

function cleanSignatory(input: unknown, fallback: CertificateSignatory): CertificateSignatory {
  if (!isObject(input)) return fallback
  return {
    id: fallback.id,
    kind: fallback.kind,
    title: typeof input.title === 'string' ? input.title.trim().slice(0, 100) : fallback.title,
    name: typeof input.name === 'string' ? input.name.trim().slice(0, 100) : '',
    signature: typeof input.signature === 'string' && SIGNATURE_PNG.test(input.signature) && input.signature.length <= MAX_CERTIFICATE_SIGNATURE ? input.signature : null,
    x: offset(input.x),
    y: offset(input.y),
    signX: offset(input.signX),
    signY: offset(input.signY),
    nameX: offset(input.nameX),
    nameY: offset(input.nameY),
  }
}

// Anything missing or out of range falls back to the default, so a saved or imported layout can never break printing
export function cleanCertificateLayout(input: unknown): CertificateLayout {
  const d = DEFAULT_CERTIFICATE_LAYOUT
  if (!isObject(input)) return d
  const lines = isObject(input.lines) ? input.lines : {}
  return {
    paper: typeof input.paper === 'string' && input.paper in CERTIFICATE_PAPER ? (input.paper as CertificatePaper) : 'a4',
    orientation: input.orientation === 'portrait' ? 'portrait' : 'landscape',
    background: typeof input.background === 'string' && input.background !== '' ? input.background : null,
    lines: Object.fromEntries(CERTIFICATE_LINE_KEYS.map((k) => [k, cleanLine(lines[k], d.lines[k])])) as Record<CertificateLineKey, CertificateLine>,
    signatories: cleanSignatories(input.signatories),
  }
}

const KINDS: CertificateSignatoryKind[] = ['organizer', 'chairperson', 'person']

// A list of signatories. A layout saved before the list existed holds the organizer, chairperson and president by name.
function cleanSignatories(input: unknown): CertificateSignatory[] {
  if (Array.isArray(input)) {
    const seen = new Set<string>()
    return input.filter(isObject).slice(0, MAX_CERTIFICATE_SIGNATORIES).map((s, i) => {
      let id = typeof s.id === 'string' ? s.id.replace(/[^\w-]/g, '').slice(0, 40) : ''
      if (!id || seen.has(id)) id = `signatory-${i + 1}`
      while (seen.has(id)) id += 'x'
      seen.add(id)
      const kind = KINDS.find((k) => k === s.kind) ?? 'person'
      return cleanSignatory(s, blankSignatory(id, kind, ''))
    })
  }
  if (isObject(input)) return DEFAULT_SIGNATORIES().map((d) => cleanSignatory(input[d.id], d))
  return DEFAULT_SIGNATORIES()
}

// A line's text for one finalist; a line whose words are all blank prints nothing
export function fillCertificateText(text: string, values: Partial<Record<(typeof CERTIFICATE_TOKENS)[number], string>>): string {
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  if (used.length > 0 && used.every((k) => !values[k as keyof typeof values])) return ''
  return text.replace(/\{(\w+)\}/g, (_, k: string) => values[k as keyof typeof values] ?? '').trim()
}
