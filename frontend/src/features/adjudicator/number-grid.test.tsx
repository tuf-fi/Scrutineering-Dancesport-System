import type { MarkingTask } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MarkSheet } from './MarkSheet.tsx'

// A round of three dances where each adjudicator marks 2 of 4 couples in every dance
const task = {
  round: { id: 'r1', eventId: 'e1', type: 'round_1', recallNumber: 2, status: 'marking' },
  event: { id: 'e1', competitionId: 'c1', number: 5, ageGroup: 'junior_1', class: 'E1', discipline: 'latin', dances: ['samba', 'cha_cha_cha', 'rumba'], isSolo: false },
  recallNumber: 2,
  dances: ['samba', 'cha_cha_cha', 'rumba'],
  competitors: [
    { id: 'a', backNumber: 11, heat: 1 },
    { id: 'b', backNumber: 12, heat: 1 },
    { id: 'c', backNumber: 13, heat: 2 },
    { id: 'd', backNumber: 14, heat: 2 },
  ],
} as unknown as MarkingTask

// The mark sheet reads the age group names, so it needs a query client like the app has
const renderSheet = (sheet: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{sheet}</QueryClientProvider>)

const number = (n: number) => screen.getByRole('button', { name: `Select ${n}` })
const tab = (name: RegExp) => screen.getByRole('tab', { name })

describe('number grid', () => {
  it('shows the back numbers as cells with three digits, grouped by heat, with a tab for each dance', () => {
    renderSheet(<MarkSheet task={task} onSubmit={() => {}} />)
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Samba0', 'Cha Cha Cha0', 'Rumba0'])
    expect(screen.getAllByRole('button', { name: /^Select / }).map((b) => b.textContent)).toEqual(['011', '012', '013', '014'])
    expect(screen.getAllByRole('heading', { name: /^Heat \d$/ }).map((h) => h.textContent)).toEqual(['Heat 1', 'Heat 2'])
  })

  it('chooses a number on a tap, takes it out on a second tap, and counts per dance', async () => {
    renderSheet(<MarkSheet task={task} onSubmit={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('0 of 3 dances done')
    await userEvent.click(number(11))
    expect(number(11)).toHaveAttribute('aria-pressed', 'true')
    expect(tab(/^Samba/)).toHaveTextContent('1')
    // Another dance has its own choices
    await userEvent.click(tab(/^Cha Cha Cha/))
    expect(number(11)).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(tab(/^Samba/))
    await userEvent.click(number(11))
    expect(number(11)).toHaveAttribute('aria-pressed', 'false')
  })

  it('submits only when every dance has exactly the recall number, and sends the marks per dance', async () => {
    const onSubmit = vi.fn()
    renderSheet(<MarkSheet task={task} onSubmit={onSubmit} />)
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    for (const dance of [/^Samba/, /^Cha Cha Cha/, /^Rumba/]) {
      await userEvent.click(tab(dance))
      await userEvent.click(number(11))
      await userEvent.click(number(13))
    }
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 dances done')
    expect(submit).toBeEnabled()

    // A full dance locks the other numbers; the chosen ones can still be taken out
    expect(number(12)).toBeDisabled()
    expect(number(11)).toBeEnabled()

    await userEvent.click(submit)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(onSubmit).toHaveBeenCalledWith([
      { dance: 'samba', competitorIds: ['a', 'c'] },
      { dance: 'cha_cha_cha', competitorIds: ['a', 'c'] },
      { dance: 'rumba', competitorIds: ['a', 'c'] },
    ])
  })
})

describe('syllabus box', () => {
  const withEvent = (over: object) => ({ ...task, event: { ...task.event, ...over } }) as unknown as MarkingTask

  it('shows the standard text under the numbers for Juvenile up to Junior I', () => {
    renderSheet(<MarkSheet task={task} onSubmit={() => {}} />)
    expect(within(screen.getByRole('region', { name: 'Syllabus' })).getByText(/Lorem ipsum/)).toBeInTheDocument()
  })

  it('shows the event own syllabus instead, in any age group', () => {
    renderSheet(<MarkSheet task={withEvent({ ageGroup: 'adult', syllabus: 'Bronze figures only' })} onSubmit={() => {}} />)
    expect(within(screen.getByRole('region', { name: 'Syllabus' })).getByText('Bronze figures only')).toBeInTheDocument()
  })

  it('has no box for older age groups without a syllabus', () => {
    renderSheet(<MarkSheet task={withEvent({ ageGroup: 'adult' })} onSubmit={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Syllabus' })).not.toBeInTheDocument()
  })
})
