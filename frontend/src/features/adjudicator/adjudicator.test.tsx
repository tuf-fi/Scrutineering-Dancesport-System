import { Role } from '@bis/shared'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useConnection } from '../../stores/connection.ts'
import { renderApp, sign } from '../../test-utils.tsx'

// The sample round state is shared across tests in this file, so they run in order as one session
const adjudicator = { id: 'adj-d', name: 'Celeste B. Ilagan', letter: 'D' }
const open = (path = '/adjudicator/waiting') => renderApp(path, Role.Adjudicator, adjudicator)

// After Submit: look over the numbers, press Final and submit, then sign to finalize
const finalize = async () => {
  const review = await screen.findByRole('dialog', { name: /^Review your/ })
  await userEvent.click(within(review).getByRole('button', { name: 'Final and submit' }))
  const signing = await screen.findByRole('dialog', { name: 'Sign to finalize' })
  // The marks cannot be sent until the adjudicator has signed
  expect(within(signing).getByRole('button', { name: 'Finalize' })).toBeDisabled()
  sign(signing)
  await userEvent.click(within(signing).getByRole('button', { name: 'Finalize' }))
}

const tilesIn = (name: string) => within(screen.getByRole('region', { name }))
const startDemo = async (label: string) => {
  await userEvent.selectOptions(await screen.findByLabelText('Round'), label)
  await userEvent.click(screen.getByRole('button', { name: 'Start round' }))
}

describe('adjudicator marking', () => {
  afterEach(() => act(() => useConnection.setState({ online: true })))

  it('marks exactly the recall number of X, then confirms and submits', async () => {
    const router = open()
    await screen.findByText(/Mark an X for exactly 12/)
    // The sheet names the event and the one after it, and how many to select
    expect(screen.getByText('Event')).toBeInTheDocument()
    expect(screen.getByText('Next event')).toBeInTheDocument()
    expect(screen.getByText('Select')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/adjudicator/mark')
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('0 of 12 marked')

    const board = tilesIn('Cha Cha Cha')
    const tiles = board.getAllByRole('button')
    expect(tiles.length).toBeGreaterThan(12)
    for (const t of tiles.slice(0, 12)) await userEvent.click(t)
    expect(screen.getByRole('status')).toHaveTextContent('12 of 12 marked')
    expect(submit).toBeEnabled()

    // Once 12 are marked, the rest are locked; a marked one can still be taken out
    expect(tiles[12]).toBeDisabled()
    expect(tiles[0]).toBeEnabled()

    await userEvent.click(submit)
    // The selection is shown for review first
    expect(await screen.findByRole('dialog', { name: 'Review your selection' })).toBeInTheDocument()
    await finalize()
    expect(await screen.findByRole('heading', { name: 'Submitted' })).toBeInTheDocument()
  })

  it('places every finalist once and lets the placings be reordered', async () => {
    open('/adjudicator/submitted')
    await startDemo('Final, one dance')
    await screen.findByText(/Place all 6 finalists/)
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    const first = within(screen.getByRole('region', { name: 'Cha Cha Cha' }))
    for (let i = 0; i < 6; i++) {
      await userEvent.click(first.getAllByRole('button', { name: /^Place / })[0])
    }
    expect(screen.getByRole('status')).toHaveTextContent('6 of 6 placed')
    expect(submit).toBeEnabled()

    const list = within(screen.getByRole('list', { name: 'Your placings' }))
    const before = list.getAllByRole('listitem').map((li) => li.textContent)
    await userEvent.click(list.getAllByRole('button', { name: /^Move .* down$/ })[0])
    const after = list.getAllByRole('listitem').map((li) => li.textContent)
    expect(after[0]).not.toBe(before[0])

    await userEvent.click(list.getAllByRole('button', { name: /^Remove / })[0])
    expect(screen.getByRole('status')).toHaveTextContent('5 of 6 placed')
    expect(submit).toBeDisabled()
    await userEvent.click(first.getAllByRole('button', { name: /^Place / })[0])

    await userEvent.click(submit)
    await finalize()
    expect(await screen.findByRole('heading', { name: 'Submitted' })).toBeInTheDocument()
  })

  it('has a tab for each dance and keeps the marks saved when offline', async () => {
    open('/adjudicator/submitted')
    await startDemo((await screen.findAllByRole('option', { name: /Final, three dances/ }))[0].textContent!)
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.length).toBe(3)
    const submit = screen.getByRole('button', { name: 'Submit' })

    for (const tab of tabs) {
      await userEvent.click(tab)
      const panel = within(screen.getByRole('region', { name: tab.textContent!.replace(/\d+$/, '') }))
      if (screen.queryByText(/Place all/)) {
        // A final: place everyone, one tap at a time
        while (panel.queryAllByRole('button', { name: /^Place / }).length > 0) {
          await userEvent.click(panel.getAllByRole('button', { name: /^Place / })[0])
        }
      } else {
        const need = Number(/exactly (\d+)/.exec(screen.getByText(/Mark an X for exactly/).textContent!)![1])
        for (const t of panel.getAllByRole('button').slice(0, need)) await userEvent.click(t)
      }
    }
    expect(submit).toBeEnabled()

    act(() => useConnection.setState({ online: false }))
    await userEvent.click(submit)
    await finalize()
    expect(await screen.findByRole('heading', { name: 'Saved, sending…' })).toBeInTheDocument()
    expect(screen.getByText(/saved on this phone/)).toBeInTheDocument()

    act(() => useConnection.setState({ online: true }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Submitted' })).toBeInTheDocument())
  })

  it('waits when no round is on the floor', async () => {
    open('/adjudicator/submitted')
    await userEvent.click(await screen.findByRole('button', { name: 'Clear floor' }))
    expect(await screen.findByRole('heading', { name: 'Waiting for the next round' })).toBeInTheDocument()
  })
})
