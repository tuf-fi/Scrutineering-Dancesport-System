import { Role } from '@bis/shared'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test-utils.tsx'

const status = vi.hoisted(() => ({
  targets: [
    { path: 'E:\\bis-backup', ok: false, lastBackupAt: null, error: 'The system cannot find the path specified.' },
    { path: 'D:\\laptop-3', ok: true, lastBackupAt: '2026-10-10T02:00:00.000Z', error: null },
  ],
  lastBackupAt: '2026-10-10T02:00:00.000Z',
}))
const asked = vi.hoisted(() => ({ count: 0 }))

vi.mock('../api/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mocks/api.ts')>()
  return {
    ...original,
    getBackupStatus: () => {
      asked.count++
      return Promise.resolve(status)
    },
  }
})

describe('backup notice', () => {
  it('tells the scrutineer which backup folder cannot be reached', async () => {
    renderApp('/scrutineer', Role.Scrutineer, { id: 'staff-scrutineer', name: 'Teresita Quimpo' })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('One backup folder cannot be reached')
    expect(alert).toHaveTextContent('E:\\bis-backup')
    expect(alert).not.toHaveTextContent('D:\\laptop-3')
    expect(alert).toHaveTextContent('Results are still saved on this laptop')
  })

  it('shows the admin as well', async () => {
    renderApp('/admin', Role.Admin, { id: 'staff-admin', name: 'Amelia Rosales' })
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be reached')
  })

  it('does not ask, or show anything, for roles that cannot act on it', async () => {
    asked.count = 0
    renderApp('/secretariat', Role.Secretariat, { id: 'staff-secretariat', name: 'Jonas Bellosillo' })
    await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0))
    expect(screen.queryByText(/backup folder/)).not.toBeInTheDocument()
    expect(asked.count).toBe(0)
  })
})
