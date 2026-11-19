import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Role } from '@bis/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../../stores/auth.ts'
import { ResultsRelease } from './ResultsRelease.tsx'

function show(role: Role, release: { hold: boolean; revealedAt: string | null; waiting: number; total: number }) {
  useAuth.setState({ user: { id: 'u1', name: 'Someone', role } as never })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['results-release', 'c1'], release)
  render(
    <QueryClientProvider client={client}>
      <ResultsRelease competitionId="c1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => useAuth.setState({ user: null }))

describe('ResultsRelease', () => {
  it('says nothing when the competition does not hold its results', () => {
    show(Role.Scrutineer, { hold: false, revealedAt: null, waiting: 0, total: 6 })
    expect(screen.queryByText(/held until the awarding/)).not.toBeInTheDocument()
  })

  it('tells the scrutineer how many finals wait and asks before revealing', async () => {
    show(Role.Scrutineer, { hold: true, revealedAt: null, waiting: 3, total: 6 })
    expect(screen.getByText('Results are held until the awarding')).toBeInTheDocument()
    expect(screen.getByText(/3 of 6 finals are published and waiting/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reveal results' }))
    expect(await screen.findByText('Reveal the results?')).toBeInTheDocument()
    expect(screen.getByText(/results of 3 events become public/)).toBeInTheDocument()
  })

  it('cannot be revealed with nothing published, or by the admin', () => {
    show(Role.Scrutineer, { hold: true, revealedAt: null, waiting: 0, total: 6 })
    expect(screen.getByRole('button', { name: 'Reveal results' })).toBeDisabled()
  })

  it('gives the admin the status but no button', () => {
    show(Role.Admin, { hold: true, revealedAt: null, waiting: 2, total: 6 })
    expect(screen.getByText('Results are held until the awarding')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal results' })).not.toBeInTheDocument()
  })

  it('notes when the results were revealed', () => {
    show(Role.Chairperson, { hold: true, revealedAt: '2026-11-19T14:00:00.000Z', waiting: 0, total: 6 })
    expect(screen.getByText(/The results were revealed at/)).toBeInTheDocument()
  })
})
