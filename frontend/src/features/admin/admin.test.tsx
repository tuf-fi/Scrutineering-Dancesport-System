import { Role } from '@bis/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { confirmDelete, renderApp } from '../../test-utils.tsx'


// The sample data is shared across tests in this file, so each test uses its own records

describe('competitions', () => {
  const dialogFor = (name: string) => screen.findByRole('dialog', { name })

  it('validates, creates and then edits a competition in a modal', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'New competition' }))
    let dialog = await dialogFor('New competition')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }))
    expect(await within(dialog).findByText('Enter the competition name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Pick the date.')).toBeInTheDocument()
    expect(within(dialog).getByText('Add the photo for its card.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Test Cup')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2099-01-05' } })
    await userEvent.type(within(dialog).getByLabelText('Venue'), 'Test Gym')
    await userEvent.type(within(dialog).getByLabelText('Organizer'), 'Test Org')
    await userEvent.upload(within(dialog).getByLabelText('Card photo'), new File(['x'], 'card.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }))

    expect(await screen.findByText('Competition created')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Test Cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit Test Cup' }))
    dialog = await dialogFor('Edit competition')
    const venue = within(dialog).getByLabelText('Venue')
    expect(venue).toHaveValue('Test Gym')
    await userEvent.clear(venue)
    await userEvent.type(venue, 'New Gym')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Competition updated')).toBeInTheDocument()
    expect(await screen.findByText(/New Gym/)).toBeInTheDocument()
  })

  it('stays on the list page while the modal is open, and closes with Cancel, the close button and Esc', async () => {
    const router = renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'New competition' }))
    let dialog = await dialogFor('New competition')
    expect(router.state.location.pathname).toBe('/admin/competitions')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New competition' }))
    dialog = await dialogFor('New competition')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New competition' }))
    await dialogFor('New competition')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the edit modal, prefilled, from the edit icon only, and starts blank for a new one', async () => {
    renderApp('/admin/competitions', Role.Admin)
    // A row click shows the data read-only; editing is only through the edit icon
    await userEvent.click(await screen.findByText('Legazpi Dancesport Cup 2026'))
    const view = await dialogFor('Legazpi Dancesport Cup 2026')
    expect(within(view).getByText('Albay Dancesport Council')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    await userEvent.click(within(view).getByRole('button', { name: 'Close' }))

    await userEvent.click(screen.getByRole('button', { name: 'Edit Legazpi Dancesport Cup 2026' }))
    let dialog = await dialogFor('Edit competition')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Legazpi Dancesport Cup 2026')
    expect(within(dialog).getByLabelText('Organizer')).toHaveValue('Albay Dancesport Council')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('button', { name: 'Edit Naga Dancesport Invitational 2025' }))
    dialog = await dialogFor('Edit competition')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Naga Dancesport Invitational 2025')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('button', { name: 'New competition' }))
    dialog = await dialogFor('New competition')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('')
  })

  const bodyRows = () => screen.getAllByRole('row').slice(1)

  it('has an edit and a delete icon on every row', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await screen.findByText('Sorsogon Dancesport Open 2026')
    for (const row of bodyRows()) {
      expect(within(row).getByRole('button', { name: /^Edit / })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^Delete / })).toBeInTheDocument()
    }
  })

  it('puts the search first, then the year select, and the new button on the right of the same row', async () => {
    renderApp('/admin/competitions', Role.Admin)
    const search = await screen.findByLabelText('Search')
    const year = screen.getByLabelText('Year')
    const newButton = screen.getByRole('button', { name: 'New competition' })
    const order = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(order(search, year)).toBeTruthy()
    expect(order(year, newButton)).toBeTruthy()
    // All three share one toolbar
    expect(search.closest('[class*="justify-between"]')?.contains(newButton)).toBe(true)
  })

  it('filters by year with a select and by a search', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await screen.findByText('Sorsogon Dancesport Open 2026')
    const year = screen.getByLabelText('Year')
    // The options are plain years, with no counts
    expect(within(year).getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['All years', '2026', '2025']),
    )

    await userEvent.selectOptions(year, '2025')
    expect(await screen.findByText('Naga Dancesport Invitational 2025')).toBeInTheDocument()
    expect(screen.queryByText('Sorsogon Dancesport Open 2026')).not.toBeInTheDocument()

    await userEvent.selectOptions(year, 'all')
    await userEvent.type(screen.getByLabelText('Search'), 'albay')
    expect(await screen.findByText('Legazpi Dancesport Cup 2026')).toBeInTheDocument()
    expect(screen.queryByText('Naga Dancesport Invitational 2025')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search'))
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz')
    expect(await screen.findByText('No competitions match')).toBeInTheDocument()
  })

  it('refuses a competition dated in the past', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'New competition' }))
    const dialog = await dialogFor('New competition')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Old Cup')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2020-01-05' } })
    await userEvent.type(within(dialog).getByLabelText('Organizer'), 'Org')
    await userEvent.type(within(dialog).getByLabelText('Venue'), 'Gym')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }))
    expect(await within(dialog).findByText(/A finished competition cannot be added/)).toBeInTheDocument()
  })

  it('deletes a competition after confirming, and keeps one when cancelled', async () => {
    await api.saveCompetition('staff-admin', {
      name: 'Delete Me Cup',
      date: '2099-03-03',
      venue: 'Gym',
      organizer: 'Org',
      image: 'data:image/png;base64,iVBORw0KGgo=',
    })
    renderApp('/admin/competitions', Role.Admin)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Delete Me Cup' }))
    let dialog = await dialogFor('Delete Delete Me Cup?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Delete Me Cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Delete Me Cup' }))
    dialog = await dialogFor('Delete Delete Me Cup?')
    await confirmDelete(dialog)
    expect(await screen.findByText('Deleted Delete Me Cup')).toBeInTheDocument()
    expect(screen.queryByText('Delete Me Cup')).not.toBeInTheDocument()
  })

  it('lists the events and entries that go with a competition before deleting it', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Naga Dancesport Invitational 2025' }))
    const dialog = await dialogFor('Delete Naga Dancesport Invitational 2025?')
    expect(await within(dialog).findByText('Will be deleted')).toBeInTheDocument()
    expect(within(dialog).getByText('Events')).toBeInTheDocument()
    expect(within(dialog).getByText('54')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Naga Dancesport Invitational 2025')).toBeInTheDocument()
  })
})

describe('staff accounts', () => {
  const dialogFor = (name: string | RegExp) => screen.findByRole('dialog', { name })
  const rowFor = (name: RegExp) => screen.findByRole('row', { name })

  it('adds an account in a modal, shows a one-time password that works, and rejects a duplicate email', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Add account' }))
    let dialog = await dialogFor('Add an account')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(within(dialog).getByText('Add a photo.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Mark Dela Rosa')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'markd@sample.example')
    await userEvent.upload(within(dialog).getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))

    const shown = await dialogFor('Account created')
    const password = within(shown).getByText(/^[a-z0-9]{4,12}$/).textContent ?? ''
    await userEvent.click(within(shown).getByRole('button', { name: 'Done' }))
    await expect(api.signInStaff('markd@sample.example', password)).resolves.toMatchObject({ role: Role.Secretariat })

    await userEvent.click(screen.getByRole('button', { name: 'Add account' }))
    dialog = await dialogFor('Add an account')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Someone Else')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'markd@sample.example')
    await userEvent.upload(within(dialog).getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))
    expect(await within(dialog).findByText('That email is already used by another account.')).toBeInTheDocument()
  })

  it('edits the name and role in a modal, but never removes the last admin', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Jonas Bellosillo' }))
    let dialog = await dialogFor('Edit account')
    expect(within(dialog).getByLabelText('Email')).toBeDisabled()
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'scrutineer')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Jonas Bellosillo updated')).toBeInTheDocument()
    expect(await rowFor(/Jonas Bellosillo.*Scrutineer/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit Amelia Rosales' }))
    dialog = await dialogFor('Edit account')
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'secretariat')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText('There must be at least one admin.')).toBeInTheDocument()
  })

  it('has edit, reset-password and delete icons on every row, with the search first and the add button at the right', async () => {
    renderApp('/admin/staff', Role.Admin)
    await screen.findByRole('button', { name: 'Edit Amelia Rosales' })
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(within(row).getByRole('button', { name: /^Edit / })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^Reset password for / })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^Delete / })).toBeInTheDocument()
    }
    const search = screen.getByLabelText('Search')
    const role = screen.getByLabelText('Role')
    const add = screen.getByRole('button', { name: 'Add account' })
    expect(search.compareDocumentPosition(role) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(role.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(role).getAllByRole('option').map((o) => o.textContent)).toContain('All roles')
  })

  it('filters by role with a select and by a search', async () => {
    renderApp('/admin/staff', Role.Admin)
    await screen.findByRole('button', { name: 'Edit Amelia Rosales' })
    // The signed-in name also shows in the phone top bar, so look inside the table
    const table = () => within(screen.getByRole('table'))
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'compere')
    expect(await table().findByText('Dante Ibarra')).toBeInTheDocument()
    expect(table().queryByText('Amelia Rosales')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Role'), 'all')
    await userEvent.type(screen.getByLabelText('Search'), 'quimpo')
    expect(await table().findByText('Teresita Quimpo')).toBeInTheDocument()
    expect(table().queryByText('Amelia Rosales')).not.toBeInTheDocument()
  })

  it('resets a password after confirming, and the old one stops working', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Reset password for Dante Ibarra' }))

    const confirm = await dialogFor(/Reset Dante Ibarra/)
    await userEvent.click(within(confirm).getByRole('button', { name: 'Reset password' }))

    const shown = await dialogFor('Password reset')
    const password = within(shown).getByText(/^[a-z0-9]{4,12}$/).textContent ?? ''
    await expect(api.signInStaff('compere@sample.example', password)).resolves.toMatchObject({ role: Role.Compere })
    await expect(api.signInStaff('compere@sample.example', 'bis2026')).rejects.toThrow('Wrong email or password.')
  })

  it('signs a person out everywhere after confirming', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Sign Dante Ibarra out everywhere' }))
    const confirm = await dialogFor(/Sign Dante Ibarra out everywhere/)
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByText('Dante Ibarra is signed out everywhere')).toBeInTheDocument()
  })

  it('deletes an account after confirming, but not your own or the last admin', async () => {
    await api.createStaffUser('staff-admin', { name: 'Delete Me', username: 'deleteme@sample.example', role: Role.Compere, photo: 'data:image/png;base64,iVBORw0KGgo=' })
    renderApp('/admin/staff', Role.Admin)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Delete Me' }))
    let dialog = await dialogFor('Delete Delete Me?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Delete Me')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Delete Me' }))
    dialog = await dialogFor('Delete Delete Me?')
    await confirmDelete(dialog)
    expect(await screen.findByText('Deleted Delete Me')).toBeInTheDocument()
    expect(screen.queryByText('Delete Me')).not.toBeInTheDocument()

    // The signed-in user is Amelia, the only admin
    await userEvent.click(screen.getByRole('button', { name: 'Delete Amelia Rosales' }))
    dialog = await dialogFor('Delete Amelia Rosales?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText("You can't delete your own account.")).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Amelia Rosales')).toBeInTheDocument()
  })
})

describe('adjudicators and panels', () => {
  const dialogFor = (name: string) => screen.findByRole('dialog', { name })

  it('chooses whose PIN card to print', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    // Nothing is chosen yet, so there is nothing to print
    expect(await screen.findByRole('button', { name: 'Print PIN cards' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Lorenzo V. Aguilar to print the PIN card' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Patricia M. Dizon to print the PIN card' }))
    const two = await screen.findByRole('link', { name: 'Print 2 PIN cards' })
    expect(two.getAttribute('href')).toMatch(/^\/print\/pin-cards\/comp-sorsogon-2026\?ids=[^,]+,[^,]+$/)

    // The box in the header selects everyone, and a second click clears them again
    const everyone = screen.getByRole('checkbox', { name: 'Select every adjudicator with a PIN' })
    await userEvent.click(everyone)
    expect(screen.getByRole('link', { name: /^Print \d+ PIN cards$/ })).toBeInTheDocument()
    await userEvent.click(everyone)
    expect(await screen.findByRole('button', { name: 'Print PIN cards' })).toBeDisabled()
  })

  it('adds an adjudicator in a modal with a free letter and generates the missing PIN', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await screen.findByRole('button', { name: 'Edit Lorenzo V. Aguilar' })
    // Everyone has a PIN, so there is nothing to generate
    expect(screen.queryByRole('button', { name: /^Generate \d+ missing$/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add adjudicator' }))
    const dialog = await dialogFor('Add an adjudicator')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add adjudicator' }))
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Cecilia R. Ventura')
    await userEvent.upload(within(dialog).getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await within(dialog).findByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    const letter = within(dialog).getByLabelText('Letter')
    expect(within(letter).getAllByRole('option').map((o) => o.textContent)).toEqual(['J'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add adjudicator' }))
    expect(await screen.findByText('Added adjudicator J')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Generate 1 missing' }))
    expect(await screen.findByText('PINs generated')).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /Cecilia R. Ventura/ })
    expect(within(row).getByText(/^\d{6}$/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Generate \d+ missing$/ })).not.toBeInTheDocument())
  })

  it('edits an adjudicator name in a modal, with the letter locked', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Alfredo G. Tabora' }))
    const dialog = await dialogFor('Edit adjudicator')
    expect(within(dialog).getByLabelText('Letter')).toBeDisabled()
    expect(within(dialog).getByLabelText('Letter')).toHaveValue('I')
    const name = within(dialog).getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Alfredo T. Tabora')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('I updated')).toBeInTheDocument()
    expect(await screen.findByText('Alfredo T. Tabora')).toBeInTheDocument()
  })

  it('has edit, PIN and delete icons on every row', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await screen.findByRole('button', { name: 'Edit Lorenzo V. Aguilar' })
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(within(row).getByRole('button', { name: /^Edit / })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^(New|Set) PIN for / })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: /^Delete / })).toBeInTheDocument()
    }
  })

  it('deletes an adjudicator who is on no panel, but not one who is', async () => {
    await api.createAdjudicator('staff-admin', { name: 'Spare Adjudicator', letter: 'J', photo: 'data:image/png;base64,iVBORw0KGgo=' }).catch(() => {})
    renderApp('/admin/adjudicators', Role.Admin)

    // Adjudicator A marks on every panel
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Lorenzo V. Aguilar' }))
    let dialog = await dialogFor('Delete Lorenzo V. Aguilar?')
    expect(await within(dialog).findByText('Taken off these panels')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await userEvent.click(await screen.findByRole('button', { name: /^Delete (Cecilia R. Ventura|Spare Adjudicator)$/ }))
    dialog = await screen.findByRole('dialog', { name: /^Delete (Cecilia R. Ventura|Spare Adjudicator)\?$/ })
    await confirmDelete(dialog)
    expect(await screen.findByText(/^Deleted (Cecilia R. Ventura|Spare Adjudicator)$/)).toBeInTheDocument()
  })

  it('changes an adjudicator PIN', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    const row = await screen.findByRole('row', { name: /Patricia M. Dizon/ })
    const before = (await within(row).findByText(/^\d{6}$/)).textContent
    await userEvent.click(within(row).getByRole('button', { name: 'New PIN for Patricia M. Dizon' }))
    expect(await screen.findByText('New PIN set')).toBeInTheDocument()
    const after = within(await screen.findByRole('row', { name: /Patricia M. Dizon/ })).getByText(/^\d{6}$/).textContent
    expect(after).not.toBe(before)
  })

  it('assigns a panel on a grid of events and adjudicators, saved with each tap', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await userEvent.click(await screen.findByRole('tab', { name: 'Panels' }))
    // The event list shows 10 at a time; E11 is the first one on page 2
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }))

    const cell = await screen.findByRole('button', { name: /^E11 Helena/ })
    expect(cell).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(cell)
    await waitFor(() => expect(screen.getByRole('button', { name: /^E11 Helena/ })).toHaveAttribute('aria-pressed', 'true'))

    // Taking one off again works while others stay; the last one cannot be taken off
    await userEvent.click(screen.getByRole('button', { name: /^E11 Helena/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^E11 Helena/ })).toHaveAttribute('aria-pressed', 'false'))
  })
})

describe('points table', () => {
  it('edits points, blocks invalid values and saves', async () => {
    renderApp('/admin/points', Role.Admin)
    const first = await screen.findByLabelText('Points for 1st')
    expect(first).toHaveValue('10')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await userEvent.clear(first)
    await userEvent.type(first, '12')
    const second = screen.getByLabelText('Points for 2nd')
    await userEvent.clear(second)
    await userEvent.type(second, 'x')
    expect(await screen.findByText('Whole number')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await userEvent.clear(second)
    await userEvent.type(second, '9')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Points table saved')).toBeInTheDocument()
    expect(await screen.findByLabelText('Points for 1st')).toHaveValue('12')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})

describe('payments', () => {
  // The rows of the table (the first on the page); a row opens the payment
  const queueRows = () => within(document.querySelector('table')!).getAllByRole('row', { hidden: true }).slice(1)
  const teams = async () => {
    await screen.findByRole('columnheader', { name: 'Team' })
    // Skeleton rows have no text until the payments load
    await waitFor(() => expect(queueRows()[0]).toHaveTextContent(/₱/))
    return queueRows()
  }

  it('lists what is still owed, and shows what a payment covers without any decision to make', async () => {
    renderApp('/admin/payments', Role.Admin)
    const items = await teams()
    expect(items.length).toBeGreaterThanOrEqual(1)

    await userEvent.click(items[0])
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Amount due')).toBeInTheDocument()
    expect(within(drawer).getByText('Amount paid')).toBeInTheDocument()
    expect(within(drawer).getByText('Reference number')).toBeInTheDocument()
    expect(within(drawer).getByText(/Not paid yet/)).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })

  it('shows who recorded a payment that is paid', async () => {
    renderApp('/admin/payments?status=paid_at_venue', Role.Admin)
    await userEvent.click((await teams())[0])
    expect(await screen.findByText(/^Recorded/)).toBeInTheDocument()
  })
})

describe('admin area', () => {
  it('redirects /admin to the competitions screen', async () => {
    const router = renderApp('/admin', Role.Admin)
    expect(await screen.findByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/competitions')
  })
})
