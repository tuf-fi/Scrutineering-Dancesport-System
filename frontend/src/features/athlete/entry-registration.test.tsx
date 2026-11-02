import { Role } from '@bis/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

// jsdom cannot decode or draw pictures, so the resizing helper is faked
vi.mock('../../lib/image.ts', () => ({ screenshotImage: async () => 'data:image/jpeg;base64,/9j/', squarePhoto: async () => 'data:image/jpeg;base64,/9j/' }))

describe('entering a competition online', () => {
  // The sample competitions are all dated before today, so the clock is set to when Legazpi (13 June 2026) is still ahead
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-01T08:00:00+08:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('opens a request in a side panel with its screenshot when the row is clicked', async () => {
    renderApp('/secretariat/entry-requests', Role.Secretariat)
    const [approve] = await screen.findAllByRole('button', { name: /^Approve the entry of/ })
    const dancer = approve!.getAttribute('aria-label')!.replace('Approve the entry of ', '')
    await userEvent.click(screen.getAllByText(dancer)[0]!)
    expect(await screen.findByText('Payment screenshot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    // The small picture opens the full one
    await userEvent.click(screen.getByRole('button', { name: 'View the payment screenshot' }))
    expect(await screen.findByAltText('Payment screenshot, full size')).toBeInTheDocument()
    // Closed again, so nothing is left locked for the next test
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Escape}')
  })

  it('lets a team send an entry with a screenshot, and the secretariat approves it', async () => {
    renderApp('/team/register', Role.Team, { id: 'member-sample-team' })
    const events = await screen.findByRole('list', { name: 'Events' })
    const [first] = await within(events).findAllByRole('checkbox')
    await userEvent.click(first!)

    // The fee shows before anything is sent
    expect((await screen.findAllByText(/₱/)).length).toBeGreaterThan(0)

    expect(screen.queryByLabelText('Reference number')).not.toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Payment screenshot'), new File(['x'], 'pay.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send to the secretariat' }))
    expect(await screen.findByText('Sent to the secretariat')).toBeInTheDocument()

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'My requests' }))
    expect((await screen.findAllByText('Waiting')).length).toBeGreaterThan(1)
    cleanup()

    renderApp('/secretariat/entry-requests', Role.Secretariat)
    // The sample already has a request waiting, so approve everything that is
    for (let left = (await screen.findAllByRole('button', { name: /^Approve the entry of/ })).length; left > 0; left--) {
      await userEvent.click(screen.getAllByRole('button', { name: /^Approve the entry of/ })[0]!)
      await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Approve the entry of/ })).toHaveLength(left - 1))
    }
    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument()
    cleanup()

    // The team hears about it, and it shows as approved
    renderApp('/team/requests', Role.Team, { id: 'member-sample-team' })
    expect((await screen.findAllByText('Approved')).length).toBeGreaterThan(1)
  })

  it('refuses to send without a screenshot', async () => {
    renderApp('/team/register', Role.Team, { id: 'member-sample-team' })
    const events = await screen.findByRole('list', { name: 'Events' })
    const boxes = await within(events).findAllByRole('checkbox')
    await userEvent.click(boxes[1] ?? boxes[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'Send to the secretariat' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Send a screenshot of your payment.'))
  })

  it('says so when the account is not linked yet', async () => {
    renderApp('/coach/register', Role.Coach, { id: 'member-sample-coach' })
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })

  it('gives an athlete their own Enter events and My requests pages', async () => {
    renderApp('/athlete/register', Role.Athlete, { id: 'athlete-sample', name: 'Ana Cruz' })
    expect(await screen.findByRole('heading', { name: 'Enter events' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'My requests' }))
    expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
    expect(await screen.findByText('No requests yet')).toBeInTheDocument()
  })

})
