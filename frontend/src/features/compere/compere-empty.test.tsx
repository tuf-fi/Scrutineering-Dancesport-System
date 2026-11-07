import { Role } from '@bis/shared'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

vi.mock('../../api/index.ts', async (original) => ({ ...(await original<typeof import('../../api/index.ts')>()), getAnnouncements: () => Promise.resolve([]) }))

describe('Compere with nothing to announce', () => {
  it('keeps the controls and the account menu on screen', async () => {
    renderApp('/compere', Role.Compere, { id: 'staff-compere', name: 'Dante Ibarra' })
    expect(await screen.findByRole('heading', { level: 1, name: /Waiting for the next announcement/ })).toBeInTheDocument()
    const controls = screen.getByRole('navigation', { name: 'Announcer controls' })
    expect(within(controls).getByRole('button', { name: /Program/ })).toBeInTheDocument()
    expect(within(controls).getByRole('button', { name: 'Full screen' })).toBeInTheDocument()
  })
})
