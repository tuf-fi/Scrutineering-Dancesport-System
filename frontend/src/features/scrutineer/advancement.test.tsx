import { Role } from '@bis/shared'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }

describe('advancement table', () => {
  it('shows the table, and saves a change', async () => {
    renderApp('/scrutineer/advancement', Role.Scrutineer, scrutineer)
    expect(await screen.findByRole('heading', { name: 'Advancement' })).toBeInTheDocument()
    // Each editable row has a box for phones and one for laptops; the first row (1 entry) is fixed text
    const values = async () => [...new Set((await screen.findAllByLabelText('From entries')).map((f) => (f as HTMLInputElement).value))]
    expect(await values()).toEqual(['8', '15', '17', '25'])

    await userEvent.click(screen.getByRole('button', { name: 'Add row' }))
    expect(await values()).toEqual(['8', '15', '17', '25', '26'])
    await userEvent.click(screen.getByRole('button', { name: 'Save table' }))
    expect(await screen.findByText('Advancement table saved')).toBeInTheDocument()
  })

  it('refuses a row that recalls as many couples as entered', async () => {
    renderApp('/scrutineer/advancement', Role.Scrutineer, scrutineer)
    const from = await screen.findAllByLabelText('From entries')
    const row = from[0] as HTMLInputElement
    await userEvent.clear(row)
    await userEvent.type(row, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save table' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot recall')
  })

  it('suggests the table to the secretariat for each event', async () => {
    const competitions = await api.getCompetitions()
    const schedule = await api.getSchedule(competitions[0]!.id)
    expect(schedule.every((s) => s.suggested.at(-1)?.type === 'final')).toBe(true)
  })
})
