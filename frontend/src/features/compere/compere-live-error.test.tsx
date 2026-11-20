import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/http.ts'

vi.mock('../../hooks/index.ts', () => ({
  useCatalog: () => ({ eventGrade: () => '' }),
  useCompetitionRounds: () => ({ data: undefined, isError: true, refetch: vi.fn() }),
  useLiveSubmissions: () => [],
}))

import { CompereLive } from './CompereLive.tsx'

describe('the compere live view', () => {
  it('says it could not load, in light type on the dark wall, instead of going blank', () => {
    const client = new QueryClient()
    client.getQueryCache().build(client, { queryKey: ['x'], queryFn: () => Promise.reject(new ApiError(500, 'down')) })
    render(
      <QueryClientProvider client={client}>
        <CompereLive competitionId="c1" />
      </QueryClientProvider>,
    )
    expect(screen.getByText("Couldn't load this")).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
