import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generateProgram, getCompetitions, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

beforeEach(() => localStorage.clear())

const counter = () => screen.getByRole('status')

describe('Compere screen', () => {
  it('starts on the next event call and steps with the keyboard', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Next to the floor')
    expect(screen.getAllByText('E11').length).toBeGreaterThan(0)
    expect(within(screen.getByLabelText('Back numbers')).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(counter()).toHaveTextContent(/^1 \//)

    // Every heat of the round is called, one after the other
    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
    expect(screen.getByLabelText('What to do')).toHaveTextContent(/^Heat2/)
    expect(counter()).toHaveTextContent(/^2 \//)

    await userEvent.keyboard('5')
    expect(await screen.findByText('Recalled to the next round')).toBeInTheDocument()

    await userEvent.keyboard('4')
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
    expect(counter()).toHaveTextContent(/^1 \//)
  })

  it('draws the call as a sheet: the event, the next event, the numbers as tiles, and what to do', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')
    // The next event, with all its details, stays on the right
    expect(screen.getByRole('complementary', { name: 'Up next event' })).toBeInTheDocument()
    // Back numbers are written with three digits
    for (const n of within(screen.getByLabelText('Back numbers')).getAllByRole('listitem')) expect(n.textContent).toMatch(/^[0-9]{3}$/)
    // What each adjudicator does with them, or that it is a final
    expect(screen.getByLabelText('What to do').textContent).toMatch(/^(Heat[0-9]+)?(Select[0-9]+|Final)$/)
  })

  it('jumps to finalists, then reads results from last place up one at a time', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('6')
    // Finalists is also the name of the control, so look at what is on the screen
    expect(await screen.findByLabelText('What to do')).toHaveTextContent('Finalists6')
    const finalists = within(screen.getByLabelText('Competitors')).getAllByRole('listitem')
    expect(finalists).toHaveLength(6)
    expect(finalists[0]).toHaveTextContent(/\d{3}/)

    await userEvent.keyboard('7')
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
    const latest = (await getCompetitions())[0]!
    await generateProgram('test', latest.id)
    await setProgramStart('test', latest.id, '07:00')
  })

  it('shows what is on the floor and next with key 3, and goes back to the slides with key 1', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('3')
    expect(await screen.findByRole('heading', { name: 'Program', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Up next' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Floor/ })).toHaveClass('text-gold-400')

    await userEvent.keyboard('1')
    expect(await screen.findByText('Next to the floor')).toBeInTheDocument()
  })

  it('lists the program ten to a page, counts pages by the competition name and opens a round to its heats', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    await screen.findByText('Next to the floor')

    await userEvent.keyboard('2')
    const program = await screen.findByRole('region', { name: 'Program' })
    expect(within(program).getAllByRole('listitem').length).toBeLessThanOrEqual(10)
    expect(counter()).toHaveTextContent(/^1 \//)
    await userEvent.keyboard('{ArrowRight}')
    expect(counter()).toHaveTextContent(/^2 \//)
    await userEvent.keyboard('{ArrowLeft}')
    expect(counter()).toHaveTextContent(/^1 \//)

    await userEvent.click(within(program).getAllByRole('button', { expanded: false })[0]!)
    // A row has focus now; the arrow keys still turn the pages
    await userEvent.keyboard('{ArrowRight}')
    expect(counter()).toHaveTextContent(/^2 \//)
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.click(within(program).getAllByRole('button', { expanded: false })[0]!)
    await userEvent.click(within(program).getAllByRole('button', { name: /^Open/ })[0]!)
    expect(screen.queryByRole('region', { name: 'Program' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show/ })).toHaveClass('text-gold-400')
  })
})
