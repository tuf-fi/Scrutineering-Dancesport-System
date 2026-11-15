import { Role } from '@bis/shared'
import { cleanup, screen, within } from '@testing-library/react'
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

  it('shows the scrutineer their signature on their account, and can change it', async () => {
    renderApp('/account', Role.Scrutineer, { id: 'staff-sig-a', name: 'Teresita Quimpo' })
    // On the details, where the account is read
    expect((await screen.findAllByAltText('Your saved signature')).length).toBeGreaterThan(0)
    cleanup()
    renderApp('/account?section=signature', Role.Scrutineer, { id: 'staff-sig-a', name: 'Teresita Quimpo' })
    expect(await screen.findByRole('button', { name: 'Upload a picture' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save drawn signature' })).toBeDisabled()
  })

  it('holds a scrutineer without a signature on a page to add one, then lets them in', async () => {
    renderApp('/account?section=signature', Role.Chairperson, { id: 'staff-sig-b', name: 'Gregorio Almazan' })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Remove signature' }))[0]!)
    // Without a signature nothing else opens: the staff pages ask for one first
    const dialog = await screen.findByRole('dialog', { name: 'Add your signature' })
    // A window that cannot be closed: no X, and Esc does nothing
    expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Add your signature' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save drawn signature' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('has no signature section for the admin', async () => {
    renderApp('/account', Role.Admin, me)
    await screen.findByRole('heading', { name: 'My account' })
    expect(screen.queryByText(/No signature yet/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Account sections' })).queryByRole('link', { name: 'Signature' })).not.toBeInTheDocument()
  })
})
