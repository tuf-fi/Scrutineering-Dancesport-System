import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../stores/auth.ts'
import { useConnection } from '../stores/connection.ts'
import { useUi } from '../stores/ui.ts'
import { renderApp } from '../test-utils.tsx'

const sidebar = async () => within(await screen.findByRole('complementary'))

// jsdom has no layout, so pretend the screen is laptop width
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  useUi.setState({ sidebarCollapsed: false })
  useConnection.setState({ online: true })
  localStorage.removeItem('bis-ui')
})

afterEach(() => {
  // @ts-expect-error restoring the jsdom default, which has no matchMedia
  delete window.matchMedia
})

describe('staff sidebar', () => {
  it('shows each section with an icon, and the signed-in user', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    const links = nav.getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual([
      'Competitions',
      'Staff accounts',
      'Adjudicators and panels',
      'Points table',
      'Payments',
    ])
    for (const link of links) expect(link.querySelector('svg')).not.toBeNull()
    expect(nav.getByText('Amelia Rosales')).toBeInTheDocument()
    expect(nav.getByText('Admin')).toBeInTheDocument()
  })

  it('has no top bar on a laptop; the connection status and sign out live in the sidebar', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    // Only the sidebar's section list exists; the phone top bar and its tab strip are not rendered
    expect(screen.getAllByRole('navigation', { name: 'Sections' })).toHaveLength(1)
    expect(nav.getByRole('button', { name: /^Online/ })).toBeInTheDocument()
    expect(nav.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    // Exactly one of each, not a second copy in a hidden top bar
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^Online/ })).toHaveLength(1)
  })

  it('puts the collapse button at the top and shows sign out in red', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    // The collapse button comes first, before the section links
    const [first] = nav.getAllByRole('button')
    expect(first).toHaveAccessibleName('Collapse sidebar')
    expect(nav.getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.includes('sidebar'))).toHaveLength(1)
    expect(nav.getByRole('button', { name: 'Sign out' }).className).toContain('text-danger')
  })

  it('flips the connection status from the sidebar', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    await userEvent.click(nav.getByRole('button', { name: /^Online/ }))
    expect(nav.getByRole('button', { name: /^Offline/ })).toHaveAttribute('aria-pressed', 'true')
    expect(useConnection.getState().online).toBe(false)
  })

  it('signs out from the sidebar and returns to the sign-in page', async () => {
    const router = renderApp('/admin/competitions', Role.Admin)
    await userEvent.click((await sidebar()).getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuth.getState().user).toBeNull()
  })

  it('keeps the status and sign out reachable when collapsed', async () => {
    useUi.setState({ sidebarCollapsed: true })
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    expect(nav.getByRole('button', { name: /^Online/ })).toBeInTheDocument()
    expect(nav.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('marks the current section', async () => {
    renderApp('/admin/payments', Role.Admin)
    const nav = await sidebar()
    expect(nav.getByRole('link', { name: 'Payments' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Staff accounts' })).not.toHaveAttribute('aria-current')
  })

  it('collapses to icons only, keeps every link reachable by name, and expands again', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const nav = await sidebar()
    const toggle = nav.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(toggle)
    expect(nav.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    // The labels become screen-reader only, so the links keep their names
    for (const name of ['Competitions', 'Staff accounts', 'Payments']) {
      const link = nav.getByRole('link', { name })
      expect(within(link).getByText(name, { selector: 'span.sr-only' })).toBeInTheDocument()
    }
    expect(document.querySelector('[data-collapsed="true"]')).not.toBeNull()

    await userEvent.click(nav.getByRole('button', { name: 'Expand sidebar' }))
    expect(nav.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(document.querySelector('[data-collapsed="false"]')).not.toBeNull()
  })

  it('remembers the choice on this device', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click((await sidebar()).getByRole('button', { name: 'Collapse sidebar' }))
    expect(useUi.getState().sidebarCollapsed).toBe(true)
    expect(localStorage.getItem('bis-ui')).toContain('"sidebarCollapsed":true')
  })

  it('starts collapsed when that was the last choice', async () => {
    useUi.setState({ sidebarCollapsed: true })
    renderApp('/admin/competitions', Role.Admin)
    expect((await sidebar()).getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it.each([
    [Role.Secretariat, '/secretariat', ['Events', 'Competitors', 'Late entries', 'Schedule']],
    [Role.Scrutineer, '/scrutineer', ['Rounds', 'Heats', 'Live board', 'Recall', 'Results']],
    [Role.Chairperson, '/scrutineer', ['Rounds', 'Heats', 'Live board', 'Recall', 'Results']],
  ])('gives the %s their own sections with icons', async (role, path, labels) => {
    renderApp(path, role)
    const links = (await sidebar()).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(labels)
    for (const link of links) expect(link.querySelector('svg')).not.toBeNull()
  })
})
