import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateProgram, getCompetitions, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

const counter = () => screen.getByRole('status')

describe('MC screen', () => {
  it('starts on the next event call and steps with the keyboard', async () => {
    renderApp('/mc', Role.Mc, { id: 'staff-mc', name: 'Dante Ibarra' })
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Next to the floor')
    expect(screen.getByText('E11')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Back numbers')).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(counter()).toHaveTextContent(/^1 \//)

    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Recalled to the next round')).toBeInTheDocument()
    expect(counter()).toHaveTextContent(/^2 \//)

    await userEvent.keyboard('{ArrowLeft}')
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
  })

  it('jumps to finalists, then reads results from last place up one at a time', async () => {
    renderApp('/mc', Role.Mc, { id: 'staff-mc', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('3')
    // Finalists is also the name of the control, so look at what is on the screen
    await screen.findByText('6 competitors')
    expect(within(screen.getByLabelText('Back numbers')).getAllByRole('listitem')).toHaveLength(6)

    await userEvent.keyboard('4')
    expect(await screen.findByText('6th place')).toBeInTheDocument()
    // Places not yet read out show a dash
    expect(within(screen.getByLabelText('Results so far')).getAllByText('—')).toHaveLength(5)

    await userEvent.keyboard(' ')
    expect(await screen.findByText('5th place')).toBeInTheDocument()
    const board = screen.getByLabelText('Results so far')
    expect(within(board).getAllByRole('listitem')).toHaveLength(6)
    expect(within(board).getByText('6th')).toBeInTheDocument()

    for (let i = 0; i < 4; i++) await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('1st place')).toBeInTheDocument()
    // The last announcement stays on screen
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('1st place')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next announcement' })).toBeDisabled()
  })

  it('steps with the on-screen buttons too', async () => {
    renderApp('/mc', Role.Mc, { id: 'staff-mc', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    await userEvent.click(screen.getByRole('button', { name: 'Next announcement' }))
    expect(counter()).toHaveTextContent(/^2 \//)
    await userEvent.click(screen.getByRole('button', { name: 'Previous announcement' }))
    expect(counter()).toHaveTextContent(/^1 \//)
  })
})

describe('MC program view', () => {
  beforeAll(async () => {
    // The MC screen reads the latest competition by date
    const latest = [...(await getCompetitions())].sort((a, b) => b.date.localeCompare(a.date))[0]!
    await generateProgram('test', latest.id)
    await setProgramStart('test', latest.id, '07:00')
  })

  it('shows what is on the floor and next with key 5, and goes back to the slides with key 1', async () => {
    renderApp('/mc', Role.Mc, { id: 'staff-mc', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('5')
    expect(await screen.findByRole('heading', { name: 'Program', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'On the floor' })).toBeInTheDocument()
    const next = screen.getByRole('region', { name: 'Up next' })
    expect(within(next).getByText(/\d:\d\d (AM|PM)/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Program/ })).toHaveClass('text-gold-400')

    await userEvent.keyboard('1')
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
    expect(counter()).toHaveTextContent(/^1 \//)
  })
})
