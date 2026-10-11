import { cn } from '../../lib/cn.ts'
import { useToast, type ToastTone } from './useToast.ts'

const tones: Record<ToastTone, string> = {
  neutral: 'bg-brown-950 text-white',
  success: 'bg-success text-white',
  danger: 'bg-danger text-white',
}

// Mount once near the app root
export function ToastViewport() {
  const { toasts, dismiss } = useToast()
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto min-h-11 max-w-md animate-toast-in rounded-md px-4 py-2.5 text-left text-small font-medium shadow-overlay',
            tones[t.tone],
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
