import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Skeleton } from './ui/index.ts'

// A QR code as a picture. It is drawn as SVG, so it stays sharp when printed and needs no canvas.
export function QrCode({ value, label, size = 128 }: { value: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((svg) => {
      if (current) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
    })
    return () => {
      current = false
    }
  }, [value])

  if (!src) return <Skeleton style={{ width: size, height: size }} />
  return <img src={src} alt={label} width={size} height={size} className="print-exact bg-white" />
}
