import { Role } from '@bis/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('barker page', () => {
  it('opens for a barker on the floor page, with a way to say nothing is on it', async () => {
    renderApp('/barker', Role.Barker)
    expect(await screen.findByRole('heading', { name: 'On the floor' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing on the floor')).toBeInTheDocument()
  })

  it('has its own page for the next event', async () => {
    renderApp('/barker/next', Role.Barker)
    expect(await screen.findByRole('heading', { name: 'Up next' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument()
  })

  it('keeps an athlete out', async () => {
    renderApp('/barker', Role.Athlete)
    expect(screen.queryByRole('heading', { name: 'On the floor' })).not.toBeInTheDocument()
  })
})
