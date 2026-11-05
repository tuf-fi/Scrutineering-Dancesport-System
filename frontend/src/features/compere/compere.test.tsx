import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateProgram, getCompetitions, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

const counter = () => screen.getByRole('status')

describe('Compere screen', () => {
  it('starts on the next event call and steps with the keyboard', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
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

  it('draws the call as a sheet: the event, the next event, the numbers as tiles, and what to do', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    // "Next event" is also the name of a control, so look inside the sheet
    const sheet = screen.getByLabelText('Back numbers').parentElement!
    expect(within(sheet).getByText('Event')).toBeInTheDocument()
    expect(within(sheet).getByText('Next event')).toBeInTheDocument()
    // Back numbers are written with three digits
    for (const n of within(screen.getByLabelText('Back numbers')).getAllByRole('listitem')) expect(n.textContent).toMatch(/^[0-9]{3}$/)
    // What each adjudicator does with them, or that it is a final
    expect(screen.getByLabelText('What to do').textContent).toMatch(/^(Heat[0-9]+)?(Select[0-9]+|Final)$/)
  })

  it('jumps to finalists, then reads results from last place up one at a time', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('3')
    // Finalists is also the name of the control, so look at what is on the screen
    expect(await screen.findByLabelText('What to do')).toHaveTextContent('Finalists6')
    expect(within(screen.getByLabelText('Back numbers')).getAllByRole('listitem')).toHaveLength(6)

    await userEvent.keyboard('4')
    // The slide that says it is time for the results comes before the first place
    expect(await screen.findByRole('heading', { level: 1, name: 'Results' })).toBeInTheDocument()
    await userEvent.keyboard(' ')
    expect(await screen.findByRole('heading', { level: 1, name: '6th place' })).toBeInTheDocument()
    // Places not yet read out show a dash
    expect(within(screen.getByLabelText('Results')).getAllByText('—')).toHaveLength(5)

    await userEvent.keyboard(' ')
    expect(await screen.findByRole('heading', { level: 1, name: '5th place' })).toBeInTheDocument()
    const board = screen.getByLabelText('Results')
    expect(within(board).getAllByRole('listitem')).toHaveLength(6)
    expect(within(board).getByText('6th')).toBeInTheDocument()

    for (let i = 0; i < 4; i++) await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByRole('heading', { level: 1, name: '1st place' })).toBeInTheDocument()
    // The last announcement stays on screen
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { level: 1, name: '1st place' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next announcement' })).toBeDisabled()
  })

  it('steps with the on-screen buttons too', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    await userEvent.click(screen.getByRole('button', { name: 'Next announcement' }))
    expect(counter()).toHaveTextContent(/^2 \//)
    await userEvent.click(screen.getByRole('button', { name: 'Previous announcement' }))
    expect(counter()).toHaveTextContent(/^1 \//)
  })
})

describe('Compere program view', () => {
  beforeAll(async () => {
    // The compere screen reads the latest competition by date
    const latest = [...(await getCompetitions())].sort((a, b) => b.date.localeCompare(a.date))[0]!
    await generateProgram('test', latest.id)
    await setProgramStart('test', latest.id, '07:00')
  })

  it('shows what is on the floor and next with key 5, and goes back to the slides with key 1', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
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

describe('Compere up next', () => {
  it('says what the next screen is before it is opened', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    const hint = screen.getByLabelText('Up next')
    expect(hint).toHaveTextContent(/Up next(Next event|Recalled)/)
    await userEvent.keyboard('3')
    await screen.findByLabelText('What to do')
    // After the finalists comes the slide that says it is time for the results
    expect(screen.getByLabelText('Up next')).toHaveTextContent('ResultsE')
    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Results' })).toBeInTheDocument()
    expect(screen.getByLabelText('Up next')).toHaveTextContent('6th place')
  })
})

describe('Compere account menu', () => {
  it('opens My account and signs out from the navbar menu', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    await userEvent.click(screen.getByRole('button', { name: /Dante Ibarra/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'My account' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
  })

  it('signs out', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    await userEvent.click(screen.getByRole('button', { name: /Dante Ibarra/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: /sign-in|Sign in/i })).toBeInTheDocument()
  })
})
