import { Role } from '@bis/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

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

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Test Cup')
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2020-01-05' } })
    await userEvent.type(within(dialog).getByLabelText('Venue'), 'Test Gym')
    await userEvent.type(within(dialog).getByLabelText('Organizer'), 'Test Org')
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
    await userEvent.click(await screen.findByText('Legazpi Dancesport Cup 2026'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

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
    expect(search.closest('.flex-wrap')?.contains(newButton)).toBe(true)
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

  it('deletes a competition after confirming, and keeps one when cancelled', async () => {
    await api.saveCompetition('staff-admin', {
      name: 'Delete Me Cup',
      date: '2019-03-03',
      venue: 'Gym',
      organizer: 'Org',
    })
    renderApp('/admin/competitions', Role.Admin)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Delete Me Cup' }))
    let dialog = await dialogFor('Delete Delete Me Cup?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Delete Me Cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Delete Me Cup' }))
    dialog = await dialogFor('Delete Delete Me Cup?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted Delete Me Cup')).toBeInTheDocument()
    expect(screen.queryByText('Delete Me Cup')).not.toBeInTheDocument()
  })

  it('will not delete a competition that already has events', async () => {
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Naga Dancesport Invitational 2025' }))
    const dialog = await dialogFor('Delete Naga Dancesport Invitational 2025?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/has 54 events, so it can't be deleted/)).toBeInTheDocument()
    expect(screen.getByText('Naga Dancesport Invitational 2025')).toBeInTheDocument()
  })
})

describe('staff accounts', () => {
  const dialogFor = (name: string | RegExp) => screen.findByRole('dialog', { name })
  const rowFor = (name: RegExp) => screen.findByRole('row', { name })

  it('adds an account in a modal, shows a one-time password that works, and rejects a duplicate username', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Add account' }))
    let dialog = await dialogFor('Add an account')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a username.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Mark Dela Rosa')
    await userEvent.type(within(dialog).getByLabelText('Username'), 'markd')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))

    const shown = await dialogFor('Account created')
    const password = within(shown).getByText(/^[a-z0-9]{4,12}$/).textContent ?? ''
    await userEvent.click(within(shown).getByRole('button', { name: 'Done' }))
    await expect(api.signInStaff('markd', password)).resolves.toMatchObject({ role: Role.Secretariat })

    await userEvent.click(screen.getByRole('button', { name: 'Add account' }))
    dialog = await dialogFor('Add an account')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Someone Else')
    await userEvent.type(within(dialog).getByLabelText('Username'), 'markd')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }))
    expect(await within(dialog).findByText('That username is taken.')).toBeInTheDocument()
  })

  it('edits the name and role in a modal, but never removes the last admin', async () => {
    renderApp('/admin/staff', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Jonas Bellosillo' }))
    let dialog = await dialogFor('Edit account')
    expect(within(dialog).getByLabelText('Username')).toBeDisabled()
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
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'mc')
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
    await expect(api.signInStaff('mc', password)).resolves.toMatchObject({ role: Role.Mc })
    await expect(api.signInStaff('mc', 'bis2026')).rejects.toThrow('Wrong username or password.')
  })

  it('deletes an account after confirming, but not your own or the last admin', async () => {
    await api.createStaffUser('staff-admin', { name: 'Delete Me', username: 'deleteme', role: Role.Mc })
    renderApp('/admin/staff', Role.Admin)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Delete Me' }))
    let dialog = await dialogFor('Delete Delete Me?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Delete Me')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Delete Me' }))
    dialog = await dialogFor('Delete Delete Me?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
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

  it('adds an adjudicator in a modal with a free letter and generates the missing PIN', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    expect(await screen.findByRole('button', { name: 'Everyone has a PIN' })).toBeDisabled()
    await screen.findByRole('button', { name: 'Edit Lorenzo V. Aguilar' })

    await userEvent.click(screen.getByRole('button', { name: 'Add adjudicator' }))
    const dialog = await dialogFor('Add an adjudicator')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add adjudicator' }))
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Cecilia R. Ventura')
    const letter = within(dialog).getByLabelText('Letter')
    expect(within(letter).getAllByRole('option').map((o) => o.textContent)).toEqual(['J'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add adjudicator' }))
    expect(await screen.findByText('Added adjudicator J')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Generate 1 missing' }))
    expect(await screen.findByText('PINs generated')).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /Cecilia R. Ventura/ })
    expect(within(row).getByText(/^\d{4}$/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Everyone has a PIN' })).toBeDisabled()
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
    await api.createAdjudicator('staff-admin', { name: 'Spare Adjudicator', letter: 'J' }).catch(() => {})
    renderApp('/admin/adjudicators', Role.Admin)

    // Adjudicator A marks on every panel
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Lorenzo V. Aguilar' }))
    let dialog = await dialogFor('Delete Lorenzo V. Aguilar?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/is on \d+ panels, so can't be deleted/)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^Delete (Cecilia R. Ventura|Spare Adjudicator)$/ }))
    dialog = await screen.findByRole('dialog', { name: /^Delete (Cecilia R. Ventura|Spare Adjudicator)\?$/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/^Deleted (Cecilia R. Ventura|Spare Adjudicator)$/)).toBeInTheDocument()
  })

  it('changes an adjudicator PIN', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    const row = await screen.findByRole('row', { name: /Patricia M. Dizon/ })
    const before = within(row).getByText(/^\d{4}$/).textContent
    await userEvent.click(within(row).getByRole('button', { name: 'New PIN for Patricia M. Dizon' }))
    expect(await screen.findByText('New PIN set')).toBeInTheDocument()
    const after = within(await screen.findByRole('row', { name: /Patricia M. Dizon/ })).getByText(/^\d{4}$/).textContent
    expect(after).not.toBe(before)
  })

  it('assigns a panel to an event', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await userEvent.click(await screen.findByRole('tab', { name: 'Panels' }))
    const events = await screen.findByRole('list', { name: 'Events' })
    // The event list shows 10 at a time; E11 is the first one on page 2
    expect(within(events).getAllByRole('button')).toHaveLength(10)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await userEvent.click(await within(events).findByRole('button', { name: /^E11 / }))

    const tile = await screen.findByRole('button', { name: /^HHelena/ })
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Save panel' })).toBeDisabled()
    await userEvent.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Save panel' }))

    expect(await screen.findByText('Panel saved for E11')).toBeInTheDocument()
    expect(await within(events).findByRole('button', { name: /^E11 .*A–H$/ })).toBeInTheDocument()
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

describe('payment checking', () => {
  // The club buttons in the queue table (the first table on the page), one per payment row
  const clubs = async () => {
    await screen.findByRole('columnheader', { name: 'Club' })
    const table = document.querySelector('table')!
    return within(table).findAllByRole('button', { hidden: true })
  }

  it('lists the payments waiting to be checked and shows the full review', async () => {
    renderApp('/admin/payments', Role.Admin)
    const items = await clubs()
    expect(items.length).toBeGreaterThanOrEqual(2)

    await userEvent.click(items[0])
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Amount due')).toBeInTheDocument()
    expect(within(drawer).getByText('Amount entered')).toBeInTheDocument()
    expect(within(drawer).getByText('Reference number')).toBeInTheDocument()
    expect(within(drawer).getByRole('img', { name: /Payment screenshot from/ })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('approves after confirming and removes it from the queue', async () => {
    renderApp('/admin/payments', Role.Admin)
    const before = (await clubs()).length
    await userEvent.click((await clubs())[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))

    const dialog = await screen.findByRole('dialog', { name: /^Approve / })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText(/^Approved /)).toBeInTheDocument()
    await screen.findByText(/Approved by Amelia Rosales/)
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(within(document.querySelector('table')!).queryAllByRole('button', { hidden: true })).toHaveLength(before - 1),
    )
  })

  it('requires a reason to reject, then shows it', async () => {
    renderApp('/admin/payments', Role.Admin)
    await userEvent.click((await clubs())[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))

    await userEvent.click(screen.getByRole('button', { name: 'Reject payment' }))
    expect(await screen.findByText('Give a reason before rejecting.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Reason for rejecting'), 'Reference number is not in the GCash record.')
    await userEvent.click(screen.getByRole('button', { name: 'Reject payment' }))
    expect(await screen.findByText(/^Rejected /)).toBeInTheDocument()
    expect(await screen.findByText('Reason: Reference number is not in the GCash record.')).toBeInTheDocument()
  })

  it('does not offer a decision on payments that are already decided', async () => {
    renderApp('/admin/payments?status=approved', Role.Admin)
    await userEvent.click((await clubs())[0])
    expect(await screen.findByText(/Approved by Amelia Rosales on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })
})

describe('admin area', () => {
  it('redirects /admin to the competitions screen', async () => {
    const router = renderApp('/admin', Role.Admin)
    expect(await screen.findByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/competitions')
  })
})
