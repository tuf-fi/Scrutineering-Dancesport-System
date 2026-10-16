import { Role } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../stores/auth.ts'
import { routes } from './routes.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const signedInAs = (role: Role) =>
  useAuth.setState({ user: { id: `test-${role}`, name: 'Test User', role, letter: 'A' } })

beforeEach(() => useAuth.setState({ user: null }))

describe('route guards', () => {
  it('sends a signed-out visitor from a staff area to the staff sign-in', async () => {
    const router = renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('sends a signed-out visitor from the adjudicator area to the PIN page', async () => {
    const router = renderAt('/adjudicator/waiting')
    expect(await screen.findByRole('heading', { name: 'Enter your PIN' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/adjudicator')
  })

  it('sends a signed-out visitor from the club portal to the club sign-in', async () => {
    const router = renderAt('/club/events')
    expect(await screen.findByRole('heading', { name: 'Club sign-in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/club/sign-in')
  })

  it("keeps each role out of other roles' areas", async () => {
    signedInAs(Role.Secretariat)
    const router = renderAt('/admin/payments')
    await screen.findByRole('heading', { name: 'Events' })
    expect(router.state.location.pathname).toBe('/secretariat')
  })

  it.each([Role.Scrutineer, Role.Chairperson])('lets the %s into the scrutineer area', async (role) => {
    signedInAs(role)
    const router = renderAt('/scrutineer/live')
    await screen.findByRole('heading', { name: 'Live board' })
    expect(router.state.location.pathname).toBe('/scrutineer/live')
  })

  it('shows the online indicator in the staff top bar', async () => {
    signedInAs(Role.Admin)
    renderAt('/admin')
    expect(await screen.findByRole('button', { name: /online/i })).toBeInTheDocument()
  })

  it('opens the public site without signing in', async () => {
    renderAt('/rankings')
    expect(await screen.findByRole('heading', { name: 'Rankings' })).toBeInTheDocument()
  })

  it('shows a not-found page for an unknown address', async () => {
    renderAt('/nope')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})

describe('staff sign-in', () => {
  it('signs in and lands on the role home', async () => {
    const router = renderAt('/login')
    await userEvent.type(await screen.findByLabelText('Username'), 'Scrutineer')
    await userEvent.type(screen.getByLabelText('Password'), 'bis2026')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Rounds' })
    expect(router.state.location.pathname).toBe('/scrutineer')
    expect(useAuth.getState().user?.role).toBe(Role.Scrutineer)
  })

  it('shows an error for a wrong password and stays signed out', async () => {
    renderAt('/login')
    await userEvent.type(await screen.findByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
    expect(useAuth.getState().user).toBeNull()
  })

  it('signs out and returns to the sign-in page', async () => {
    signedInAs(Role.Admin)
    const router = renderAt('/admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuth.getState().user).toBeNull()
  })
})

describe('adjudicator PIN sign-in', () => {
  it('signs in with a valid PIN and shows the adjudicator letter', async () => {
    const router = renderAt('/adjudicator')
    await screen.findByRole('heading', { name: 'Enter your PIN' })
    for (const digit of '4100') await userEvent.click(screen.getByRole('button', { name: digit }))
    // A round is on the floor, so the waiting screen hands over to marking
    await screen.findByText(/Mark an X for exactly 12/)
    expect(router.state.location.pathname).toBe('/adjudicator/mark')
    expect(useAuth.getState().user?.letter).toBe('A')
  })

  it('rejects an unknown PIN and clears the entry', async () => {
    renderAt('/adjudicator')
    await screen.findByRole('heading', { name: 'Enter your PIN' })
    for (const digit of '0000') await userEvent.click(screen.getByRole('button', { name: digit }))
    expect(await screen.findByText(/That PIN isn't registered/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("That PIN isn't registered")
    expect(screen.getByRole('img', { name: '0 of 4 digits entered' })).toBeInTheDocument()
  })

  it('makes every keypad key at least 56px tall', async () => {
    renderAt('/adjudicator')
    const key = await screen.findByRole('button', { name: '5' })
    // The keys scale with the window height but never drop below 3.5rem (56px); they are round, so width and height are the same
    expect(key.className).toMatch(/size-\[max\(3\.5rem,/)
  })
})

describe('dev role switcher', () => {
  it('switches role from the keyboard shortcut', async () => {
    const router = renderAt('/login')
    await screen.findByRole('heading', { name: 'Sign in' })
    await userEvent.keyboard('{Control>}{Shift>}d{/Shift}{/Control}')
    await userEvent.click(await screen.findByRole('button', { name: 'Admin' }))
    await screen.findByRole('heading', { name: 'Competitions' })
    expect(router.state.location.pathname).toBe('/admin/competitions')
  })
})
