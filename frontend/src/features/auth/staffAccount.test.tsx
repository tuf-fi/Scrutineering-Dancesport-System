import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('my account (staff)', () => {
  // jsdom has no layout, so pretend the screen is laptop width: that is where the sidebar is
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    // @ts-expect-error restoring the jsdom default, which has no matchMedia
    delete window.matchMedia
  })

  const me = { id: 'staff-admin', name: 'Amelia Rosales' }

  it('shows who is signed in, links to it from the sidebar, and saves a new name', async () => {
    renderApp('/admin/competitions', Role.Admin, me)
    await userEvent.click(await screen.findByRole('link', { name: /Amelia Rosales/ }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()

    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Amelia R. Rosales')
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText('Name saved')).toBeInTheDocument()
  })

  it('changes the password from its own section, only with the current one', async () => {
    renderApp('/account?section=password', Role.Admin, me)
    await userEvent.type(await screen.findByLabelText('Current password'), 'not-my-password')
    await userEvent.type(screen.getByLabelText('New password'), 'A-new-password1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'A-new-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Your current password is not right.')).toBeInTheDocument()

    // The sections are in the second sidebar, like the fees page
    const menu = within(screen.getByRole('navigation', { name: 'Account sections' }))
    expect(menu.getByRole('link', { name: 'Password' })).toHaveAttribute('aria-current', 'page')
  })
})
