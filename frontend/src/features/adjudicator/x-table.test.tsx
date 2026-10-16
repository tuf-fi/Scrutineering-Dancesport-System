import type { MarkingTask } from '@bis/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const cell = (number: number, dance: string) => screen.getByRole('button', { name: `X for ${number}, ${dance}` })

describe('X table', () => {
  it('has a row for each back number and a column for each dance, grouped by heat', () => {
    render(<MarkSheet task={task} onSubmit={() => {}} />)
    const table = within(screen.getByRole('table'))
    expect(within(table.getAllByRole('row')[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['No.', 'Samba0/2', 'Cha Cha Cha0/2', 'Rumba0/2'])
    expect(table.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Heat 1', '11', '12', 'Heat 2', '13', '14'])
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('puts an X in a cell on a tap, takes it out on a second tap, and counts per dance', async () => {
    render(<MarkSheet task={task} onSubmit={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('0 of 3 dances done')
    await userEvent.click(cell(11, 'Samba'))
    expect(cell(11, 'Samba')).toHaveAttribute('aria-pressed', 'true')
    expect(cell(11, 'Cha Cha Cha')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(cell(11, 'Samba'))
    expect(cell(11, 'Samba')).toHaveAttribute('aria-pressed', 'false')
  })

  it('submits only when every dance has exactly the recall number, and sends the marks per dance', async () => {
    const onSubmit = vi.fn()
    render(<MarkSheet task={task} onSubmit={onSubmit} />)
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    for (const dance of ['Samba', 'Cha Cha Cha', 'Rumba']) {
      await userEvent.click(cell(11, dance))
      await userEvent.click(cell(13, dance))
    }
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 dances done')
    expect(submit).toBeEnabled()

    // A third X in one dance is too many
    await userEvent.click(cell(12, 'Rumba'))
    expect(screen.getByRole('status')).toHaveTextContent('Too many X in a dance')
    expect(submit).toBeDisabled()
    await userEvent.click(cell(12, 'Rumba'))

    await userEvent.click(submit)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(onSubmit).toHaveBeenCalledWith([
      { dance: 'samba', competitorIds: ['a', 'c'] },
      { dance: 'cha_cha_cha', competitorIds: ['a', 'c'] },
      { dance: 'rumba', competitorIds: ['a', 'c'] },
    ])
  })
})
