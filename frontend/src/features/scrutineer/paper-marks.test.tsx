import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }

describe('paper marks', () => {
  it('types in the sheet of an adjudicator who has not submitted, and then drops them from the list', async () => {
    renderApp('/scrutineer/paper-marks', Role.Scrutineer, scrutineer)
    expect(await screen.findByRole('heading', { name: 'Paper marks' })).toBeInTheDocument()

    const who = await screen.findByLabelText('Adjudicator')
    await waitFor(() => expect(within(who).getAllByRole('option').length).toBeGreaterThan(1))
    const options = within(who).getAllByRole('option').slice(1)
    const chosen = options[0]!
    await userEvent.selectOptions(who, chosen)
    const name = chosen.textContent!.split(' · ')[1]!

    const section = await screen.findByRole('region', { name: `Marks of ${name}` })
    // Mark the recall number of couples on the sheet
    const numbers = await within(section).findAllByRole('button', { pressed: false })
    const needed = Number(within(section).getByRole('status').textContent?.match(/of (\d+)/)?.[1] ?? 0)
    expect(needed).toBeGreaterThan(0)
    for (const button of numbers.slice(0, needed)) await userEvent.click(button)

    await userEvent.click(within(section).getByRole('button', { name: 'Submit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(`Enter the marks of ${name}?`)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enter marks' }))

    expect(await screen.findByText(`Marks entered for ${name}`)).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByLabelText('Adjudicator')).queryByRole('option', { name: chosen.textContent! })).not.toBeInTheDocument())
  })

  it('is not offered to the chairperson, who only watches', async () => {
    renderApp('/scrutineer/paper-marks', Role.Chairperson, { id: 'staff-chairperson', name: 'Gregorio Almazan' })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Paper marks' })).not.toBeInTheDocument())
  })
})

describe('the admin and the secretariat screens', () => {
  it('opens the secretariat screens as the admin, with them in the menu', async () => {
    renderApp('/secretariat/entry-requests', Role.Admin, { id: 'staff-admin', name: 'Amelia Rosales' })
    expect(await screen.findByRole('heading', { name: 'Entry requests' })).toBeInTheDocument()
  })
})
