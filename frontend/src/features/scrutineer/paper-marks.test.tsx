import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }
const chairperson = { id: 'staff-chairperson', name: 'Gregorio Almazan' }

describe('paper marks', () => {
  it('lists the panel for the round on the floor, with Enter marks for those who have not submitted', async () => {
    renderApp('/scrutineer/paper', Role.Scrutineer, scrutineer)
    expect(await screen.findByRole('heading', { name: 'Paper marks' })).toBeInTheDocument()
    // The live round starts with three of seven in
    expect(await screen.findByRole('button', { name: 'Enter paper marks for D' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Enter paper marks for / })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Enter paper marks for A' })).not.toBeInTheDocument()
    // Opens the blank sheets of the event on the floor, at the address the print screens really use
    expect(screen.getByRole('link', { name: 'Print blank sheets' })).toHaveAttribute('href', expect.stringMatching(/^\/print\/blank-sheets\/.+/))
  })

  it('types in a sheet exactly like the adjudicator would, and records it', async () => {
    renderApp('/scrutineer/paper', Role.Scrutineer, scrutineer)
    await userEvent.click(await screen.findByRole('button', { name: 'Enter paper marks for D' }))
    expect(await screen.findByRole('heading', { name: /Paper marks for D/ })).toBeInTheDocument()
    const need = Number(/exactly (\d+)/.exec(screen.getByText(/Mark an X for exactly/).textContent!)![1])
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    const tiles = within(screen.getByRole('region', { name: 'Cha Cha Cha' })).getAllByRole('button')
    for (const tile of tiles.slice(0, need)) await userEvent.click(tile)
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Enter these marks for D?')).toBeInTheDocument()
    expect(within(dialog).getByText(/typed in by you from a paper sheet/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enter marks' }))

    expect(await screen.findByText('Marks entered for D')).toBeInTheDocument()
    // Back to the list: D is no longer offered
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Paper marks' })).toBeInTheDocument())
  })

  it('lets the scrutineer go back without entering anything', async () => {
    renderApp('/scrutineer/paper', Role.Scrutineer, scrutineer)
    await userEvent.click((await screen.findAllByRole('button', { name: /^Enter paper marks for / }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Paper marks' })).toBeInTheDocument()
  })

  it('is for the scrutineer only: the chairperson has no menu entry and is sent back', async () => {
    renderApp('/scrutineer/paper', Role.Chairperson, chairperson)
    expect(await screen.findByRole('heading', { name: 'Rounds' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Paper marks' })).not.toBeInTheDocument()
  })

  it('has a menu entry for the scrutineer', async () => {
    renderApp('/scrutineer', Role.Scrutineer, scrutineer)
    expect((await screen.findAllByRole('link', { name: 'Paper marks' })).length).toBeGreaterThan(0)
  })
})
