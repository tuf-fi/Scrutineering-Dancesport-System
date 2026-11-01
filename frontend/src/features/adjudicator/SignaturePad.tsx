import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '../../components/ui/index.ts'

// Drawn at no more than this many device pixels per CSS pixel, to keep the PNG small
const MAX_RATIO = 2

interface SignaturePadProps {
  // The drawing as a PNG data URL, or null while the box is blank
  onChange: (png: string | null) => void
}

// A box to sign in with a finger or a stylus
export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [inked, setInked] = useState(false)

  // Match the drawing surface to the box, so a line lands where the finger is
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO)
    const { width, height } = el.getBoundingClientRect()
    el.width = Math.round(width * ratio)
    el.height = Math.round(height * ratio)
    const ctx = el.getContext('2d')
    ctx?.scale(ratio, ratio)
    if (ctx) {
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = getComputedStyle(el).color
    }
  }, [])

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const ctx = e.currentTarget.getContext('2d')
    const { x, y } = point(e)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
    // A tap leaves a dot
    ctx?.lineTo(x + 0.01, y)
    ctx?.stroke()
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')
    const { x, y } = point(e)
    ctx?.lineTo(x, y)
    ctx?.stroke()
  }

  function end(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    setInked(true)
    onChange(e.currentTarget.toDataURL('image/png'))
  }

  function clear() {
    const el = canvas.current
    el?.getContext('2d')?.clearRect(0, 0, el.width, el.height)
    setInked(false)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvas}
        role="img"
        aria-label="Signature box"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-40 w-full touch-none rounded-lg border border-neutral-300 bg-white text-neutral-900"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-neutral-600">{inked ? 'Signed' : 'Sign in the box with your finger'}</p>
        <Button variant="ghost" size="lg" disabled={!inked} onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
