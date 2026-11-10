import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('Offline day', () => {
  it('hands a competition over, loads the venue laptop day file after a trial, and can take it back', async () => {
    renderApp('/admin/offline-day', 'admin')
    expect(await screen.findByRole('heading', { name: 'Offline day' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download database copy' })).toHaveAttribute('href', '/api/offline/database')

    const start = (await screen.findAllByRole('button', { name: /^Start the offline day of/ }))[0]!
    await userEvent.click(start)
    expect(await screen.findByText(/paused online/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hand it over' }))

    // Now with the venue laptop: load its day file
    await userEvent.click((await screen.findAllByRole('button', { name: /^Load the day file of/ }))[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Load it' })).toBeDisabled()
    await userEvent.upload(within(dialog).getByLabelText('Day file'), new File(['{"format":"bis-day-1"}'], 'day.json', { type: 'application/json' }))
    expect(await within(dialog).findByText(/The file is fine/)).toBeInTheDocument()
    expect(within(dialog).getByText('Marks')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Load it' }))
    expect(await screen.findAllByRole('button', { name: /^Start the offline day of/ })).not.toHaveLength(0)
  })

  it('says so when the file is not a day file, and lets a lost laptop be taken back', async () => {
    renderApp('/admin/offline-day', 'admin')
    await userEvent.click((await screen.findAllByRole('button', { name: /^Start the offline day of/ }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Hand it over' }))
    await userEvent.click((await screen.findAllByRole('button', { name: /^Load the day file of/ }))[0]!)
    const dialog = await screen.findByRole('dialog')
    await userEvent.upload(within(dialog).getByLabelText('Day file'), new File(['bad'], 'x.json', { type: 'application/json' }))
    expect(await within(dialog).findByText('This is not a BIS competition day file.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Load it' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await userEvent.click((await screen.findAllByRole('button', { name: /^Take back/ }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Take it back' }))
    expect(await screen.findAllByRole('button', { name: /^Start the offline day of/ })).not.toHaveLength(0)
  })
})
