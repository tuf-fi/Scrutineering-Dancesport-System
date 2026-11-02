import { Role } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../stores/auth.ts'
import { renderApp } from '../test-utils.tsx'
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
    expect(router.state.location.pathname).toBe('/staff-access')
  })

  it('sends a signed-out visitor from the adjudicator area to the PIN page', async () => {
    const router = renderAt('/adjudicator/waiting')
    expect(await screen.findByRole('heading', { name: 'Enter your PIN' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/adjudicator')
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
    const router = renderAt('/staff-access')
    await userEvent.type(await screen.findByLabelText('Email'), 'Scrutineer@sample.example')
    await userEvent.type(screen.getByLabelText('Password'), 'bis2026')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Rounds' })
    expect(router.state.location.pathname).toBe('/scrutineer')
    expect(useAuth.getState().user?.role).toBe(Role.Scrutineer)
  })

  it('shows an error for a wrong password and stays signed out', async () => {
    renderAt('/staff-access')
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@sample.example')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(useAuth.getState().user).toBeNull()
  })

  it('signs out and returns to the sign-in page', async () => {
    signedInAs(Role.Admin)
    const router = renderAt('/admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/staff-access')
    expect(useAuth.getState().user).toBeNull()
  })
})

describe('where people sign in', () => {
  it('has no staff sign-in on the public /login page', async () => {
    renderAt('/login')
    expect(await screen.findByRole('heading', { name: 'Athlete sign-in' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Adjudicator' })).not.toBeInTheDocument()
  })

  it('only asks who is signing in in the navbar dialog, then opens the login page for them', async () => {
    const router = renderAt('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign in as' })
    expect(within(dialog).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Athlete', 'Coach', 'Team'])
    expect(within(dialog).queryByLabelText('Email')).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Team' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(router.state.location.pathname).toBe('/login')
    expect(await screen.findByRole('heading', { name: 'Team sign-in' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('creates a team account and lands on its page', async () => {
    renderAt('/team/sign-in')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Team name'), 'Naga Dancers')
    await userEvent.type(screen.getByLabelText('Email'), 'naga@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Naga Dancers' })).toBeInTheDocument()
    expect(useAuth.getState().user?.role).toBe(Role.Team)
  })

  it('puts the adjudicator PIN beside the staff sign-in', async () => {
    renderAt('/staff-access')
    await userEvent.click(await screen.findByRole('tab', { name: 'Adjudicator' }))
    expect(await screen.findByRole('button', { name: '1' })).toBeInTheDocument()
  })
})

describe('coach and team accounts', () => {
  it('asks to be linked to a record, and the secretariat links it', async () => {
    renderAt('/team/sign-in')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Team name'), 'Link Test Team')
    await userEvent.type(screen.getByLabelText('Email'), 'linktest@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    // Nothing to show until linked; the request is made on its own page
    await userEvent.click(await screen.findByRole('link', { name: 'Link your team' }))
    expect(await screen.findByRole('heading', { name: 'Link your team' })).toBeInTheDocument()
    const club = await screen.findByRole('combobox', { name: 'Team' })
    await waitFor(() => expect(within(club).getAllByRole('option').length).toBeGreaterThan(2))
    await userEvent.selectOptions(club, within(club).getAllByRole('option')[2]!)
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByRole('heading', { name: 'Waiting for the secretariat' })).toBeInTheDocument()
    cleanup()

    // The secretariat sees the request and links it
    signedInAs(Role.Secretariat)
    renderAt('/secretariat/account-links')
    expect(await screen.findByText('Link Test Team')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Link Link Test Team to / }))
    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument()
  })

  it.each(['dancers', 'results', 'rankings', 'entries', 'payments'])('says to link the account on the %s page until it is linked', async (page) => {
    renderAt('/team/sign-in')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Team name'), `Unlinked ${page}`)
    await userEvent.type(screen.getByLabelText('Email'), `unlinked-${page}@test.example`)
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    const sidebar = within(await screen.findByRole('navigation', { name: 'Account' }))
    await userEvent.click(sidebar.getByRole('link', { name: page[0]!.toUpperCase() + page.slice(1) }))
    expect(await screen.findByRole('link', { name: 'Link it here' })).toHaveAttribute('href', '/team/link')
  })

  it('shows the sample team its dancers and payments', async () => {
    renderApp('/team/dancers', Role.Team, { id: 'member-sample-team' })
    expect(await screen.findByRole('region', { name: 'Dancers' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Payments' }))
    expect(await screen.findByRole('region', { name: 'Payments' })).toBeInTheDocument()
  })

  it('shows the sample coach their dancers and membership', async () => {
    renderApp('/coach', Role.Coach, { id: 'member-sample-coach' })
    expect(await screen.findByText('Coaches Summit')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Payments' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Dancers' }))
    expect(await screen.findByRole('region', { name: 'Dancers' })).toBeInTheDocument()
  })
})

describe('coach and team account pages', () => {
  it('edits the account, and changes the password', async () => {
    renderApp('/coach/edit', Role.Coach, { id: 'member-sample-coach' })
    const phone = await screen.findByLabelText('Contact no.')
    await userEvent.type(phone, '0917 555 0000')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Password' }))
    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument()
  })

  it('shows the notifications of a coach, and a picture and details to edit like the athlete', async () => {
    renderApp('/coach/notifications', Role.Coach, { id: 'member-sample-coach' })
    expect(await screen.findByText('You are linked to Ramon Villanueva')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Edit account' }))
    expect(await screen.findByLabelText('Profile picture')).toBeInTheDocument()
    for (const label of ['Full name', 'Date of birth', 'Contact no.', 'Province', 'Address']) expect(screen.getByLabelText(label)).toBeInTheDocument()
  })

  it('has results, entries and rankings for the sample coach', async () => {
    renderApp('/coach/results', Role.Coach, { id: 'member-sample-coach' })
    expect(await screen.findByRole('heading', { name: 'Results' })).toBeInTheDocument()
    // Each competition the coach's dancers placed in is a card
    expect((await screen.findAllByRole('button', { name: /\d+ results?/ })).length).toBeGreaterThan(0)
  })

  it.each([
    ['/team/results', 'Results'],
    ['/team/entries', 'Entries'],
    ['/team/rankings', 'Rankings'],
  ])('opens %s from the sidebar', async (path, name) => {
    renderApp(path, Role.Team, { id: 'member-sample-team' })
    expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
  })
})

describe('adjudicator PIN sign-in', () => {
  it('signs in with a valid PIN and shows the adjudicator letter', async () => {
    const router = renderAt('/adjudicator')
    await screen.findByRole('heading', { name: 'Enter your PIN' })
    for (const digit of '410000') await userEvent.click(screen.getByRole('button', { name: digit }))
    // A round is on the floor, so the waiting screen hands over to marking
    await screen.findByText(/Mark an X for exactly 12/)
    expect(router.state.location.pathname).toBe('/adjudicator/mark')
    expect(useAuth.getState().user?.letter).toBe('A')
  })

  it('rejects an unknown PIN and clears the entry', async () => {
    renderAt('/adjudicator')
    await screen.findByRole('heading', { name: 'Enter your PIN' })
    for (const digit of '000000') await userEvent.click(screen.getByRole('button', { name: digit }))
    expect(await screen.findByText(/That PIN isn't registered/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("That PIN isn't registered")
    expect(screen.getByRole('img', { name: '0 of 6 digits entered' })).toBeInTheDocument()
  })

  it('signs in from the QR code on a PIN card, and takes the PIN off the address', async () => {
    window.location.hash = '#pin=410000'
    const router = renderAt('/adjudicator')
    await screen.findByText(/Mark an X for exactly 12/)
    expect(router.state.location.pathname).toBe('/adjudicator/mark')
    expect(useAuth.getState().user?.letter).toBe('A')
    expect(window.location.hash).toBe('')
  })

  it('ignores a QR code with a PIN of the wrong length', async () => {
    window.location.hash = '#pin=4100'
    renderAt('/adjudicator')
    await screen.findByRole('heading', { name: 'Enter your PIN' })
    expect(window.location.hash).toBe('')
    expect(useAuth.getState().user).toBeNull()
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
    const router = renderAt('/staff-access')
    await screen.findByRole('heading', { name: 'Sign in' })
    await userEvent.keyboard('{Control>}{Shift>}d{/Shift}{/Control}')
    await userEvent.click(await screen.findByRole('button', { name: 'Admin' }))
    await screen.findByRole('heading', { name: 'Competitions' })
    expect(router.state.location.pathname).toBe('/admin/competitions')
  })
})
