import { Toaster as Sonner } from 'sonner'

// Mount once near the app root; fire toasts with `toast` from components/ui
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-md bg-brown-950 px-4 py-3 text-small font-medium text-white shadow-overlay',
          success: '!bg-success',
          error: '!bg-danger',
          title: 'text-small font-medium',
          description: 'text-small opacity-80',
        },
      }}
    />
  )
}
