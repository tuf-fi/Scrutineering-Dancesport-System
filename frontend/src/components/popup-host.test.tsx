import { Role } from '@bis/shared'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitAlert, notifyAthlete } from '../mocks/api.ts'
import { usePopups } from '../stores/popups.ts'
import { renderApp } from '../test-utils.tsx'

const chime = vi.hoisted(() => vi.fn())
vi.mock('../lib/chime.ts', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/chime.ts')>()), playChime: chime }))

describe('pop-up notifications', () => {
  beforeEach(() => {
    chime.mockClear()
    usePopups.setState({ items: [] })
  })

  it('pops up a staff alert with a chime on the screen of the role it is for, and opens where it leads', async () => {
    const router = renderApp('/secretariat', Role.Secretariat)
    await screen.findByRole('heading', { name: 'Events' })
    act(() => emitAlert([Role.Secretariat], { title: 'New entry request', detail: 'Ana Cruz · Naga Dancers', link: '/secretariat/entry-requests' }))

    expect(await screen.findByText('New entry request')).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz · Naga Dancers')).toBeInTheDocument()
    expect(chime).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByText('New entry request'))
    expect(router.state.location.pathname).toBe('/secretariat/entry-requests')
    expect(screen.queryByText('Ana Cruz · Naga Dancers')).not.toBeInTheDocument()
  })

  it('does not show an alert that is for another role', async () => {
    renderApp('/scrutineer', Role.Scrutineer)
    await screen.findByRole('heading', { name: 'Rounds' })
    act(() => emitAlert([Role.Secretariat], { title: 'New entry request', detail: '', link: null }))
    expect(screen.queryByText('New entry request')).not.toBeInTheDocument()
    expect(chime).not.toHaveBeenCalled()
  })

  it('pops up what an athlete is told as it arrives, but not what was already there', async () => {
    renderApp('/athlete/results', Role.Athlete, { id: 'athlete-sample', name: 'Ana Cruz' })
    await screen.findByRole('heading', { name: 'My results' })
    act(() => notifyAthlete('athlete-sample', { kind: 'membership_confirmed', title: 'Your 2026 membership was confirmed', detail: 'Paid by GCash.', link: '/athlete/membership' }))

    expect(await screen.findByText('Your 2026 membership was confirmed')).toBeInTheDocument()
    expect(chime).toHaveBeenCalledTimes(1)
  })

  it('can be dismissed', async () => {
    renderApp('/secretariat', Role.Secretariat)
    await screen.findByRole('heading', { name: 'Events' })
    act(() => emitAlert([Role.Secretariat], { title: 'Account link request', detail: 'Team 1', link: null }))
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Account link request')).not.toBeInTheDocument()
  })
})
