import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { queryClient } from './app/queryClient.ts'
import { router } from './app/routes.tsx'
import { registerServiceWorker } from './app/pwa.ts'
import { restoreSession } from './app/session.ts'
import { useOutbox } from './stores/outbox.ts'

// The cookie says who this is; learn that first so a refresh does not flash the sign-in screen
await restoreSession()
// Marks this phone was still holding when the page closed go out again once it is online
await useOutbox.getState().restore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

void registerServiceWorker()
