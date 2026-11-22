const A4_RATIO = 297 / 210

// Saves a printout as a PDF file. Elements marked data-pdf-page each become a page of their own; otherwise the whole
// printout is cut into A4 pages. Anything marked data-pdf-skip (hints, page guides) is left out.
export async function downloadPdf(root: HTMLElement, fileName: string, widthMm = 210) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const marked = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')]
  const sheets = marked.length > 0 ? marked : [root]
  const filter = (node: HTMLElement) => node.dataset?.pdfSkip === undefined

  let pdf: InstanceType<typeof jsPDF> | null = null
  for (const sheet of sheets) {
    const { width, height } = sheet.getBoundingClientRect()
    const png = await toPng(sheet, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, filter })
    const heightMm = (widthMm * height) / width

    if (marked.length > 0) {
      const orientation = widthMm > heightMm ? 'landscape' : 'portrait'
      if (pdf) pdf.addPage([widthMm, heightMm], orientation)
      else pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation })
      pdf.addImage(png, 'PNG', 0, 0, widthMm, heightMm)
      continue
    }

    // One long sheet: the same picture on each page, shifted up by a page at a time
    const pageMm = widthMm * A4_RATIO
    pdf = new jsPDF({ unit: 'mm', format: [widthMm, pageMm] })
    for (let page = 0; page * pageMm < heightMm; page++) {
      if (page > 0) pdf.addPage([widthMm, pageMm])
      pdf.addImage(png, 'PNG', 0, -page * pageMm, widthMm, heightMm)
    }
  }
  pdf?.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
