import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('fees and payment details', () => {
  it('shows the saved fees, saves them, and saves a way to pay as soon as it is added', async () => {
    renderApp('/admin/fees', Role.Admin)
    expect(await screen.findByLabelText('Solo, per event (₱)')).toHaveValue('500')
    expect(screen.getByLabelText('Couple, per event (₱)')).toHaveValue('800')

    await userEvent.click(screen.getByRole('button', { name: 'Add a way to pay' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Union Bank')
    await userEvent.type(within(dialog).getByLabelText('Account name'), 'Bicol Dance Org')
    await userEvent.type(within(dialog).getByLabelText('Number'), '1234 5678')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Way to pay added')).toBeInTheDocument()
    expect(await screen.findByText('Union Bank')).toBeInTheDocument()

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(await screen.findByText('Fees saved')).toBeInTheDocument()
  })

  it('refuses fees that are not whole pesos', async () => {
    renderApp('/admin/fees', Role.Admin)
    const solo = await screen.findByLabelText('Solo, per event (₱)')
    await userEvent.clear(solo)
    await userEvent.type(solo, '12.5')
    expect(await screen.findByText('Whole pesos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('clubs', () => {
  it('adds and deletes a club, and will not delete one that has competitors', async () => {
    renderApp('/admin/clubs', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Add club' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add club' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add club' }))
    expect(await within(dialog).findByText('Enter the club name.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Club'), 'Zamboanga Steps')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add club' }))
    expect(await screen.findByText('Added Zamboanga Steps')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search clubs'), 'Zamboanga')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Zamboanga Steps' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted Zamboanga Steps')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search clubs'))
    await userEvent.click((await screen.findAllByRole('button', { name: /^Delete / }))[0]!)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/has competitors/)).toBeInTheDocument()
  })
})

describe('registration fees', () => {
  it('shows the organizer’s schedule, saves an edit, and refuses a price that is not whole pesos', async () => {
    renderApp('/admin/fees', Role.Admin)
    const first = await screen.findByLabelText('Solo, juvenile, first entry')
    expect(first).toHaveValue('400')
    expect(screen.getByLabelText('Couple, junior, youth and inter-high school, each extra entry')).toHaveValue('250')
    expect(screen.getByLabelText('Coach membership (₱)')).toHaveValue('1000')
    const save = screen.getByRole('button', { name: 'Save registration fees' })
    expect(save).toBeDisabled()

    await userEvent.clear(first)
    await userEvent.type(first, '12.5')
    expect(save).toBeDisabled()
    await userEvent.clear(first)
    await userEvent.type(first, '450')
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(await screen.findByText('Registration fees saved')).toBeInTheDocument()
    expect(await screen.findByLabelText('Solo, juvenile, first entry')).toHaveValue('450')
  })
})
