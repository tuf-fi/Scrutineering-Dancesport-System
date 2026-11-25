import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { confirmDelete, renderApp } from '../../test-utils.tsx'

describe('fees and payment details', () => {
  it('saves a way to pay as soon as it is added', async () => {
    renderApp('/admin/fees?section=accounts', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Add a way to pay' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Union Bank')
    await userEvent.type(within(dialog).getByLabelText('Account name'), 'Bicol Dance Org')
    await userEvent.type(within(dialog).getByLabelText('Number'), '1234 5678')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Way to pay added')).toBeInTheDocument()
    expect(await screen.findByText('Union Bank')).toBeInTheDocument()
  })

  it('saves the membership fees, and refuses one that is not whole pesos', async () => {
    renderApp('/admin/fees?section=memberships', Role.Admin)
    const coach = await screen.findByLabelText('Coach membership (₱)')
    expect(coach).toHaveValue('1000')
    const save = screen.getByRole('button', { name: 'Save membership fees' })
    expect(save).toBeDisabled()
    await userEvent.clear(coach)
    await userEvent.type(coach, '12.5')
    expect(save).toBeDisabled()
    await userEvent.clear(coach)
    await userEvent.type(coach, '1200')
    await userEvent.click(save)
    expect(await screen.findByText('Membership fees saved')).toBeInTheDocument()
  })
})

describe('competitors per team', () => {
  it('opens the athletes of one team from its count, and the filter is the team', async () => {
    renderApp('/secretariat/teams', Role.Secretariat)
    // The counts arrive after the teams, so wait for a team that has competitors
    const link = await waitFor(() => {
      const found = screen.getAllByRole('link', { name: /competitors of / }).find((l) => !(l.getAttribute('aria-label') ?? '').startsWith('0 '))
      if (!found) throw new Error('The counts have not loaded yet')
      return found
    })
    expect(link.getAttribute('href')).toMatch(/^\/secretariat\/athletes\?team=/)
    const label = link.getAttribute('aria-label') ?? ''
    const team = label.replace(/^\d+ competitors of /, '')
    await userEvent.click(link)

    expect(await screen.findByRole('heading', { name: 'Athletes' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Team')).toHaveDisplayValue(team)
    // Only that team's athletes are listed, 10 at a time
    await waitFor(() => expect(screen.getAllByRole('row').length - 1).toBeGreaterThan(0))
    expect(screen.getAllByRole('row').length - 1).toBeLessThanOrEqual(10)
  })
})

describe('teams', () => {
  it('adds and deletes a team, and will not delete one that still has dancers', async () => {
    renderApp('/secretariat/teams', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Add team' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add team' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add team' }))
    expect(await within(dialog).findByText('Enter the team name.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Team'), 'Zamboanga Steps')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add team' }))
    expect(await screen.findByText('Added Zamboanga Steps')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search teams'), 'Zamboanga')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Zamboanga Steps' }))
    await confirmDelete(await screen.findByRole('dialog'))
    expect(await screen.findByText('Deleted Zamboanga Steps')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search teams'))
    await userEvent.click((await screen.findAllByRole('button', { name: /^Delete / }))[0]!)
    const impact = await screen.findByRole('dialog')
    expect(await within(impact).findByText(/Move them to another team first/)).toBeInTheDocument()
    expect(within(impact).getByText(/^Dancers and couples/)).toBeInTheDocument()
    expect(within(impact).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })
})

describe('event fees', () => {
  it('adds a fee with its optional prices, edits it and removes it', async () => {
    renderApp('/admin/fees', Role.Admin)
    const add = await screen.findByRole('button', { name: 'Add fee' })
    await waitFor(() => expect(add).toBeEnabled())
    await userEvent.click(add)
    const dialog = await screen.findByRole('dialog', { name: 'Add fee' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add fee' }))
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Showcase')
    await userEvent.type(within(dialog).getByLabelText('Price per entry (₱)'), '750')
    // The other prices are asked only when ticked
    expect(within(dialog).queryByLabelText('Each extra entry (₱)')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /different price for extra entries/ }))
    await userEvent.type(within(dialog).getByLabelText('Each extra entry (₱)'), '125')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add fee' }))
    expect(await screen.findByText('Fee added')).toBeInTheDocument()

    // It is the last row, which may be on a later page
    const showing = async () => {
      let next = screen.queryByRole('button', { name: 'Next page' })
      while (!screen.queryByRole('button', { name: 'Edit Showcase' }) && next && !next.hasAttribute('disabled')) {
        await userEvent.click(next)
        next = screen.queryByRole('button', { name: 'Next page' })
      }
      return screen.findByRole('button', { name: 'Edit Showcase' })
    }
    await userEvent.click(await showing())
    const edit = await screen.findByRole('dialog', { name: 'Edit fee' })
    expect(within(edit).getByLabelText('Each extra entry (₱)')).toHaveValue('125')
    await userEvent.click(within(edit).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Showcase' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Fee removed')).toBeInTheDocument()
  })
})

describe('the assignments of an adjudicator', () => {
  it('open from the side panel as competitions that expand to their events', async () => {
    renderApp('/admin/adjudicators', Role.Admin)
    await userEvent.click(await screen.findByText('Lorenzo V. Aguilar'))
    const panel = await screen.findByRole('dialog', { name: 'Lorenzo V. Aguilar' })
    await userEvent.click(within(panel).getByRole('button', { name: 'Assignments' }))

    const list = await within(panel).findByRole('list', { name: 'Assignments' })
    const [competition] = within(list).getAllByRole('button', { expanded: false })
    await userEvent.click(competition!)
    expect(competition).toHaveAttribute('aria-expanded', 'true')
    expect(within(list).getAllByText(/^E\d+$/).length).toBeGreaterThan(0)
  })
})
