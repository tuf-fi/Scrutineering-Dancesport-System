import { Role } from '@bis/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DANCE_LABEL } from '../../lib/format.ts'
import { adjudicatorState } from '../../mocks/adjudicating.ts'
import { getRedances, startRedance, submitAdjudicatorMarks } from '../../mocks/api.ts'
import { renderApp, sign } from '../../test-utils.tsx'

// A heat danced again: the scrutineer orders it, and an adjudicator who had marked it marks just that heat once more.
// The sample round state is shared across the tests in this file, so they run in order as one session.

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }
const adjudicator = { id: 'adj-d', name: 'Celeste B. Ilagan', letter: 'D' }

describe('redance', () => {
  it('has the adjudicator mark the round first, so there is something to redo', async () => {
    const state = adjudicatorState('adj-d')
    if (state.status !== 'marking') throw new Error('expected a round to mark')
    const { task } = state
    const ids = task.competitors.slice(0, task.recallNumber ?? 0).map((c) => c.id)
    await submitAdjudicatorMarks('adj-d', task.round.id, task.dances.map((dance) => ({ dance, competitorIds: ids })))
    expect(adjudicatorState('adj-d').status).toBe('submitted')
  })

  it('is ordered from the Heats page with a reason, and says who still has to re-mark', async () => {
    renderApp('/scrutineer/heats', Role.Scrutineer, scrutineer)
    await userEvent.click(await screen.findByRole('button', { name: 'Redance a heat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Redance a heat' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redance' }))
    expect(await within(dialog).findByText('Give the reason in a few words.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Adjudicator D asked')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redance' }))
    expect(await screen.findByText(/Redance of heat 1: 0 of 1 adjudicators have marked it again/)).toBeInTheDocument()
    // Heats cannot change while it waits
    expect(screen.queryByRole('button', { name: 'Save heats' })).not.toBeInTheDocument()
    cleanup()
  })

  it('shows on the live board, and the adjudicator is back on the sheet for that heat only', async () => {
    renderApp('/scrutineer/live', Role.Scrutineer, scrutineer)
    expect(await screen.findByText(/Redance, heat 1: Adjudicator D asked/)).toBeInTheDocument()
    cleanup()

    const state = adjudicatorState('adj-d')
    if (state.status !== 'marking' || !state.redance) throw new Error('expected a redance sheet')
    const { redance } = state
    const router = renderApp('/adjudicator/mark', Role.Adjudicator, adjudicator)
    expect(await screen.findByText('Redance: heat 1. Mark this heat again.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/adjudicator/mark')
    const dance = state.task.dances[0]!
    const needed = redance.counts[dance] ?? 0
    expect(screen.getByText(`Mark an X for exactly ${needed} in this dance, as before.`)).toBeInTheDocument()
    // Only that heat's competitors are on the sheet
    const board = within(screen.getByRole('region', { name: DANCE_LABEL[dance] }))
    expect(board.getAllByRole('button').length).toBeLessThanOrEqual(redance.competitorIds.length)

    const tiles = board.getAllByRole('button')
    for (const tile of tiles.slice(0, needed)) await userEvent.click(tile)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    const review = await screen.findByRole('dialog', { name: /^Review your/ })
    await userEvent.click(within(review).getByRole('button', { name: 'Final and submit' }))
    const signing = await screen.findByRole('dialog', { name: 'Sign to finalize' })
    sign(signing)
    await userEvent.click(within(signing).getByRole('button', { name: 'Finalize' }))
    expect(await screen.findByRole('heading', { name: 'Submitted' })).toBeInTheDocument()
    await waitFor(async () => expect((await getRedances(redance.seq ? state.task.round.id : ''))[0]?.doneAt).toBeTruthy())
    cleanup()
  })

  it('is also there for the final, as a redance of the whole final', async () => {
    const finalId = 'comp-sorsogon-2026:e12:final'
    // The sample final is already decided, so it is offered only while it is being marked
    const router = renderApp(`/scrutineer/heats?round=${finalId}`, Role.Scrutineer, scrutineer)
    await screen.findByRole('heading', { name: 'Heats' })
    expect(router.state.location.search).toContain('final')
    expect(screen.queryByRole('button', { name: 'Redance a heat' })).not.toBeInTheDocument()
    await expect(startRedance('staff-scrutineer', finalId, 1, 'ab')).rejects.toThrow(/reason/)
  })
})
