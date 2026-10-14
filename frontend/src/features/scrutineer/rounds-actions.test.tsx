import { Role } from '@bis/shared'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }
const chairperson = { id: 'staff-chairperson', name: 'Gregorio Almazan' }
const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('starting rounds', () => {
  it('offers Start on rounds that can begin and puts the round on the floor', async () => {
    renderApp('/scrutineer', Role.Scrutineer, scrutineer)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    const start = await screen.findAllByRole('button', { name: /^Start E\d+ / })
    expect(start.length).toBeGreaterThan(0)
    await userEvent.click(start[0]!)
    expect(await screen.findByText('Round on the floor')).toBeInTheDocument()
  })

  it('does not offer Start on a round whose earlier round is not approved yet', async () => {
    renderApp('/scrutineer', Role.Scrutineer, scrutineer)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    await screen.findAllByRole('button', { name: /^Start E\d+ / })
    // E11 is the live event: its Round 2 is marking, so its Semi-final and Final must wait
    expect(screen.queryByRole('button', { name: 'Start E11 Semi-final' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start E11 Final' })).not.toBeInTheDocument()
  })

  it('shows the chairperson the rounds without any controls', async () => {
    cleanup()
    renderApp('/scrutineer', Role.Chairperson, chairperson)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    expect(screen.queryByRole('button', { name: /^Start E\d+ / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plan rounds' })).not.toBeInTheDocument()
  })
})

describe('planning rounds', () => {
  it('plans rounds for events that have none and says when there is nothing to plan', async () => {
    cleanup()
    renderApp('/scrutineer', Role.Scrutineer, scrutineer)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Plan rounds' }))
    expect(await screen.findByText('Every event with entries already has its rounds')).toBeInTheDocument()
  })
})
