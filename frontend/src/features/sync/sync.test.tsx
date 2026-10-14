import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

describe('cloud sync', () => {
  it('shows the connection, downloads a competition and lets an admin release it', async () => {
    renderApp('/admin/sync', Role.Admin)
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('sample-venue')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^Download Sorsogon Dancesport Open 2026$/ }))
    expect(await screen.findByText(/^Downloaded Sorsogon Dancesport Open 2026/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Release Sorsogon Dancesport Open 2026' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Release Sorsogon Dancesport Open 2026' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release' }))
    expect(await screen.findByText('Sorsogon Dancesport Open 2026 is back online')).toBeInTheDocument()
  })

  it('lets the secretariat download but not release', async () => {
    renderApp('/secretariat/sync', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: /^Download Legazpi/ }))
    expect(await screen.findByText(/^Downloaded Legazpi/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Release/ })).not.toBeInTheDocument()
  })

  it('sends what is waiting on request', async () => {
    renderApp('/admin/sync', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Send now' }))
    expect(await screen.findByText('Everything is on the cloud')).toBeInTheDocument()
  })
})

describe('taking a competition back', () => {
  it('lets an admin reopen a competition a venue is holding', async () => {
    await api.pullCompetition('comp-naga-2025')
    renderApp('/admin/competitions', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: /^Take back Naga Dancesport Invitational 2025 from / }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Anything it has not sent yet will be missing/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take back' }))
    expect(await screen.findByText(/open for entries and payments again/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Take back Naga/ })).not.toBeInTheDocument()
  })
})
