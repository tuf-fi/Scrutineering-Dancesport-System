import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/http.ts'
import { ErrorState } from './ErrorState.tsx'

function Page({ status, tone }: { status: number; tone?: 'light' | 'dark' }) {
  const query = useQuery({
    queryKey: ['x', status],
    queryFn: () => Promise.reject(new ApiError(status, 'nope')),
    retry: false,
  })
  return query.isError ? <ErrorState tone={tone} onRetry={() => {}} /> : null
}

const show = (status: number, tone?: 'light' | 'dark') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Page status={status} tone={tone} />
    </QueryClientProvider>,
  )

describe('ErrorState', () => {
  it.each([403, 404, 409])('says there is no data when the server answers %s', async (status) => {
    show(status)
    expect(await screen.findByText('No data available')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it.each([0, 500])('still offers a retry when the request fails with %s', async (status) => {
    show(status)
    expect(await screen.findByText("Couldn't load this")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('draws light text on a dark wall', async () => {
    show(500, 'dark')
    expect(await screen.findByText("Couldn't load this")).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveClass('text-white')
  })
})
