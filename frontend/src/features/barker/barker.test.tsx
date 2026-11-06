import { Role } from '@bis/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('barker page', () => {
  it('opens for a barker, with a way to say nothing is waiting', async () => {
    renderApp('/barker', Role.Barker)
    expect(await screen.findByRole('heading', { name: 'Barker' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing to call')).toBeInTheDocument()
  })

  it('keeps an athlete out', async () => {
    renderApp('/barker', Role.Athlete)
    expect(screen.queryByRole('heading', { name: 'Barker' })).not.toBeInTheDocument()
  })
})
