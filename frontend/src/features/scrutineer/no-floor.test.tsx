import { Role } from '@bis/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

const scrutineer = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }

// With nothing on the floor a round screen shows the round that is open or next, and never waits for one that is not there
describe('a round screen with no round on the floor', () => {
  it('shows a round instead of a loading placeholder', async () => {
    await api.clearFloor('staff-scrutineer')
    renderApp('/scrutineer/live', Role.Scrutineer, scrutineer)
    expect(await screen.findByRole('region', { name: 'On the floor' })).toBeInTheDocument()
  })
})
