import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('fees and payment details', () => {
  it('shows the saved fees, adds a way to pay and saves', async () => {
    renderApp('/admin/fees', Role.Admin)
    expect(await screen.findByLabelText('Solo, per event (₱)')).toHaveValue('500')
    expect(screen.getByLabelText('Couple, per event (₱)')).toHaveValue('800')

    await userEvent.click(screen.getByRole('button', { name: 'Add a way to pay' }))
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    const names = screen.getAllByLabelText('Name')
    await userEvent.type(names[names.length - 1]!, 'Union Bank')
    const accounts = screen.getAllByLabelText('Account name')
    await userEvent.type(accounts[accounts.length - 1]!, 'Bicol Dance Org')
    const numbers = screen.getAllByLabelText('Number')
    await userEvent.type(numbers[numbers.length - 1]!, '1234 5678')
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
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
  it('gives a temporary password on reset, and asks before erasing', async () => {
    renderApp('/admin/clubs', Role.Admin)
    const reset = (await screen.findAllByRole('button', { name: /^Reset the password of / }))[0]!
    await userEvent.click(reset)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByText(/temporary password to/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    await userEvent.click((await screen.findAllByRole('button', { name: /^Erase the account of / }))[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/club name and its dancers stay/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Erase' }))
    expect(await screen.findByText(/^Erased the account of/)).toBeInTheDocument()
  })

  it('removes old payment proofs on request', async () => {
    renderApp('/admin/clubs', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove old payment proofs' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Nothing was old enough to remove')).toBeInTheDocument()
  })
})
