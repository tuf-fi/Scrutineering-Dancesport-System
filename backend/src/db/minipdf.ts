// A plain-text PDF writer with no dependencies, so a server can hand out a sheet (a list of logins) without a PDF tool.
// A4, Helvetica for text and Courier for the lines marked as code, as many pages as the lines need.

export interface PdfLine {
  text: string
  // 'title' is large, 'heading' is bold, 'code' is monospaced, 'muted' is small and grey
  style?: 'title' | 'heading' | 'code' | 'muted'
}

const PAGE = { w: 595, h: 842, margin: 50 }
const STYLE = {
  title: { font: 'F2', size: 20, lead: 30, gray: 0 },
  heading: { font: 'F2', size: 12, lead: 22, gray: 0 },
  code: { font: 'F3', size: 9, lead: 14, gray: 0 },
  muted: { font: 'F1', size: 9, lead: 14, gray: 0.4 },
  text: { font: 'F1', size: 10.5, lead: 16, gray: 0 },
} as const

// Only the 7-bit characters the built-in fonts handle: anything else is turned into "?"
const clean = (s: string) => [...s].map((ch) => (ch.charCodeAt(0) < 127 && ch.charCodeAt(0) > 31 ? ch : '?')).join('')
const escape = (s: string) => clean(s).replace(/([\\()])/g, '\\$1')

// Breaks a long line at spaces so it stays inside the margins (Helvetica is about half as wide as it is tall)
function wrap(line: PdfLine): PdfLine[] {
  const st = STYLE[line.style ?? 'text']
  const max = Math.floor((PAGE.w - PAGE.margin * 2) / (st.size * (line.style === 'code' ? 0.6 : 0.52)))
  if (clean(line.text).length <= max) return [line]
  const out: PdfLine[] = []
  let current = ''
  for (const word of line.text.split(' ')) {
    if (current && clean(current + ' ' + word).length > max) {
      out.push({ ...line, text: current })
      current = word
    } else current = current ? current + ' ' + word : word
  }
  out.push({ ...line, text: current })
  return out
}

export function textPdf(input: PdfLine[]): Buffer {
  const lines = input.flatMap(wrap)
  const pages: string[] = []
  let ops: string[] = []
  let y = PAGE.h - PAGE.margin
  const flush = () => {
    pages.push(ops.join('\n'))
    ops = []
    y = PAGE.h - PAGE.margin
  }
  for (const line of lines) {
    const st = STYLE[line.style ?? 'text']
    if (y - st.lead < PAGE.margin) flush()
    y -= st.lead
    ops.push(`BT /${st.font} ${st.size} Tf ${st.gray} g ${PAGE.margin} ${y} Td (${escape(line.text)}) Tj ET`)
  }
  flush()

  // Objects: 1 catalog, 2 pages, 3 to 5 fonts, then a page and its content for each sheet
  const objects: string[] = []
  const kids: number[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
  pages.forEach((content, i) => {
    const pageId = 6 + i * 2
    const contentId = pageId + 1
    kids.push(pageId)
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  })
  objects[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out)
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
