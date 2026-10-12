import type { Role, SessionUser } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { routes } from './app/routes.tsx'
import { useAuth } from './stores/auth.ts'

// Renders the whole app at a path, signed in as the given role (or signed out)
export function renderApp(path: string, role?: Role, user: Partial<SessionUser> = {}) {
  useAuth.setState({
    user: role ? { id: 'staff-admin', name: 'Amelia Rosales', role, letter: 'A', ...user } : null,
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
