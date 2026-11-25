const A4 = { width: 210, height: 297 }
const MARGIN_MM = 12
// A sheet only a little taller than its paper is shrunk onto it; a longer one carries on to another page
const MAX_SHRINK = 1.15

// Where each page of one long sheet starts and ends, in mm from its top. A page ends under the last row that fits whole.
export function pageSlices(heightMm: number, pageMm: number, rowEnds: number[]) {
  const slices: Array<{ start: number; end: number }> = []
  let start = 0
  while (start < heightMm) {
    // The first page already has the sheet's own padding at its top
    const room = pageMm - MARGIN_MM * (start === 0 ? 1 : 2)
    if (heightMm - start <= pageMm - (start === 0 ? 0 : MARGIN_MM)) {
      slices.push({ start, end: heightMm })
      break
    }
    const fits = rowEnds.filter((y) => y > start && y <= start + room)
    const end = fits.length > 0 ? Math.max(...fits) : start + room
    slices.push({ start, end })
    start = end
  }
  return slices
}

// Saves a printout as a PDF file whose pages are all the given paper. Each element marked data-pdf-page starts a page
// of its own; otherwise the whole printout is cut into pages. Anything marked data-pdf-skip (hints, page guides) is left out.
export async function downloadPdf(root: HTMLElement, fileName: string, paper: { width: number; height: number } = A4) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const filter = (node: HTMLElement) => node.dataset?.pdfSkip === undefined

  // Drawn at the paper's width whatever the screen, so a phone does not cut the table off
  const { width: oldWidth, maxWidth: oldMaxWidth } = root.style
  root.style.width = root.style.maxWidth = `${paper.width}mm`
  // Taken out before measuring too, or the rows measure lower than they are drawn
  const skipped = [...root.querySelectorAll<HTMLElement>('[data-pdf-skip]')].map((el) => ({ el, display: el.style.display }))
  for (const { el } of skipped) el.style.display = 'none'
  // A box that scrolls sideways on screen would have its scrollbar drawn into the picture
  const scrollers = [...root.querySelectorAll<HTMLElement>('.overflow-x-auto')]
  for (const el of scrollers) el.style.overflow = 'visible'

  const orientation = paper.width > paper.height ? 'landscape' : 'portrait'
  const format = [paper.width, paper.height]
  const pdf = new jsPDF({ unit: 'mm', format, orientation, compress: true })
  let pages = 0
  const nextPage = () => {
    if (pages++ > 0) pdf.addPage(format, orientation)
  }
  try {
    const marked = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')]
    for (const [index, sheet] of (marked.length > 0 ? marked : [root]).entries()) {
      const { width, height, top } = sheet.getBoundingClientRect()
      const rowEnds = [...sheet.querySelectorAll('tr, li')].map((row) => ((row.getBoundingClientRect().bottom - top) * paper.width) / width)
      // The picture copies the on-screen margins; the centring one would push the sheet off its right edge
      const png = await toPng(sheet, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, filter, style: { margin: '0' } })
      const heightMm = (paper.width * height) / width
      const name = `sheet-${index}`

      if (marked.length > 0 && heightMm <= paper.height * MAX_SHRINK) {
        const scale = Math.min(1, paper.height / heightMm)
        nextPage()
        pdf.addImage(png, 'PNG', (paper.width * (1 - scale)) / 2, 0, paper.width * scale, heightMm * scale, name)
        continue
      }

      // One long sheet: the same picture on each page, shifted up, with the rest of the page painted white
      for (const [page, { start, end }] of pageSlices(heightMm, paper.height, rowEnds).entries()) {
        nextPage()
        const offset = page === 0 ? 0 : MARGIN_MM
        pdf.addImage(png, 'PNG', 0, offset - start, paper.width, heightMm, name)
        pdf.setFillColor(255, 255, 255)
        if (offset > 0) pdf.rect(0, 0, paper.width, offset, 'F')
        const bottom = offset + end - start
        if (bottom < paper.height) pdf.rect(0, bottom, paper.width, paper.height - bottom + 1, 'F') // past the edge, or a hairline shows
      }
    }
  } finally {
    Object.assign(root.style, { width: oldWidth, maxWidth: oldMaxWidth })
    for (const { el, display } of skipped) el.style.display = display
    for (const el of scrollers) el.style.overflow = ''
  }
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
