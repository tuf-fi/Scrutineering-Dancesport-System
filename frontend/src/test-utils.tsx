import type { Role, SessionUser } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { queryDefaults } from './app/queryClient.ts'
import { routes } from './app/routes.tsx'
import { useAuth } from './stores/auth.ts'

// Renders the whole app at a path, signed in as the given role (or signed out)
export function renderApp(path: string, role?: Role, user: Partial<SessionUser> = {}) {
  useAuth.setState({
    user: role ? { id: 'staff-admin', name: 'Amelia Rosales', role, letter: 'A', ...user } : null,
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { ...queryDefaults, queries: { ...queryDefaults?.queries, staleTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// Draws a stroke in the signature box of an open dialog
export function sign(dialog: HTMLElement) {
  const box = within(dialog).getByRole('img', { name: 'Signature box' })
  fireEvent.pointerDown(box)
  fireEvent.pointerMove(box)
  fireEvent.pointerUp(box)
}

// On a phone-sized screen (the test default) the staff sections are in a drawer; this opens it
export async function openMenu() {
  const { screen } = await import('@testing-library/react')
  const userEvent = (await import('@testing-library/user-event')).default
  await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }))
}
