import { MAX_CERTIFICATE_BACKGROUND } from '@bis/shared'

const MAX_DESIGN_BYTES = 10 * 1024 * 1024

// The longest side of the stored design in pixels: A4 at about 150 dpi
const LONGEST = 1754

function toJpeg(canvas: HTMLCanvasElement): string {
  for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= MAX_CERTIFICATE_BACKGROUND) return url
  }
  throw new Error('That design is too detailed to save. Try a simpler or smaller file.')
}

async function drawPdf(file: File, canvas: HTMLCanvasElement) {
  // Loaded only when a PDF is chosen
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: LONGEST / Math.max(base.width, base.height) })
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot read PDF files.')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise
}

// A designed certificate (JPG, PNG, WebP or the first page of a PDF, up to 10 MB), shrunk to a picture the server will keep.
// `portrait` says which way round the design is, so the page can follow it.
export async function certificateDesign(file: File): Promise<{ picture: string; portrait: boolean }> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!pdf && !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG, WebP or PDF file.')
  if (file.size > MAX_DESIGN_BYTES) throw new Error('The file exceeded the maximum size of 10 MB.')
  const canvas = document.createElement('canvas')
  if (pdf) {
    try {
      await drawPdf(file, canvas)
    } catch {
      throw new Error('That PDF could not be read.')
    }
  } else {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot resize pictures.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
  }
  return { picture: toJpeg(canvas), portrait: canvas.height > canvas.width }
}
