import { Role } from '@bis/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

// The sample round state is shared across tests in this file, so they run in order as one session:
// the live round starts with three of seven adjudicators in and finishes during the live board test
const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }
const chairperson = { id: 'staff-chairperson', name: 'Gregorio Almazan' }
const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('rounds dashboard', () => {
  it('shows the round on the floor and every round, and opens a round read-only', async () => {
    renderApp('/scrutineer', Role.Scrutineer, scrutineer)
    const floor = await screen.findByRole('region', { name: 'On the floor' })
    expect(within(floor).getByText('Marking')).toBeInTheDocument()
    expect(within(floor).getByText('Round 2')).toBeInTheDocument()
    expect(await within(floor).findByText(/of 7/)).toBeInTheDocument()

    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    expect(bodyRows()).toHaveLength(10)
    await userEvent.click(bodyRows()[0].querySelectorAll('td')[1])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Status')).toBeInTheDocument()
  })
})

describe('heats', () => {
  it('splits a round evenly into heats and saves them, and is read-only for the chairperson', async () => {
    renderApp('/scrutineer/heats', Role.Scrutineer, scrutineer)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    const size = screen.getByLabelText('Per heat')
    await userEvent.clear(size)
    await userEvent.type(size, '8')
    await userEvent.click(screen.getByRole('button', { name: 'Split evenly' }))
    expect(screen.getByRole('status')).toHaveTextContent('3 heats')
    await userEvent.click(screen.getByRole('button', { name: 'Save heats' }))
    expect(await screen.findByText('Heats saved')).toBeInTheDocument()

    cleanup()
    renderApp('/scrutineer/heats', Role.Chairperson, chairperson)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    expect(screen.getByRole('status')).toHaveTextContent('3 heats')
    expect(screen.queryByRole('button', { name: 'Save heats' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Per heat')).not.toBeInTheDocument()
  })
})

describe('recall', () => {
  it('flags the tie at the cutoff, lets the scrutineer propose and the chairperson confirm', async () => {
    renderApp('/scrutineer/recall', Role.Scrutineer, scrutineer)
    const tie = await screen.findByRole('region', { name: 'Tie at the cutoff' })
    expect(screen.getByRole('status')).toHaveTextContent('Recall 12')
    expect(screen.getAllByText('Recalled').length).toBeGreaterThan(0)
    // The tied competitors sit on the cutoff, which falls on the second page
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect((await screen.findAllByText('Tied')).length).toBeGreaterThan(0)

    await userEvent.click(within(tie).getByRole('button', { name: 'Propose decision' }))
    expect(await screen.findByText('Decision proposed')).toBeInTheDocument()
    expect(await within(tie).findByText(/Waiting for the chairperson to confirm/)).toBeInTheDocument()
    expect(within(tie).queryByRole('button', { name: 'Confirm tie decision' })).not.toBeInTheDocument()

    cleanup()
    renderApp('/scrutineer/recall', Role.Chairperson, chairperson)
    const seen = await screen.findByRole('region', { name: 'Tie at the cutoff' })
    expect(within(seen).queryByRole('button', { name: 'Propose decision' })).not.toBeInTheDocument()
    await userEvent.click(await within(seen).findByRole('button', { name: 'Confirm tie decision' }))
    expect(await screen.findByText('Tie decision confirmed')).toBeInTheDocument()
    expect(await within(seen).findByText(/Confirmed by Gregorio Almazan/)).toBeInTheDocument()
  })
})

describe('live board', () => {
  it('shows every adjudicator and counts submissions up to all in', async () => {
    renderApp('/scrutineer/live', Role.Scrutineer, scrutineer)
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      expect(await screen.findByText(letter)).toBeInTheDocument()
    }
    expect(screen.queryByText('H')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/of 7 adjudicators have submitted/)
    expect(await screen.findByRole('link', { name: /Review the recall/ }, { timeout: 13_000 })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('7 of 7')
  }, 20_000)
})

describe('results', () => {
  it('shows each adjudicator’s marks, then approves and publishes after confirming', async () => {
    renderApp('/scrutineer/results', Role.Scrutineer, scrutineer)
    expect(await screen.findByRole('columnheader', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'G' })).toBeInTheDocument()
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0))

    await userEvent.click(await screen.findByRole('button', { name: 'Approve results' }))
    let dialog = await screen.findByRole('dialog', { name: 'Approve these results?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Results approved')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Publish results' }))
    dialog = await screen.findByRole('dialog', { name: 'Publish these results?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Results published')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publish results' })).not.toBeInTheDocument())
  })

  it('shows a final as a placings matrix with majority columns and no buttons for the chairperson', async () => {
    renderApp('/scrutineer/results', Role.Chairperson, chairperson)
    const select = await screen.findByLabelText('Round')
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1))
    const final = within(select).getAllByRole('option').find((o) => /Final/.test(o.textContent ?? '') && /E12/.test(o.textContent ?? ''))!
    await userEvent.selectOptions(select, final)
    expect(await screen.findByRole('columnheader', { name: '1–6' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /results$/ })).not.toBeInTheDocument()
  })
})
