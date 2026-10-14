import { Role, type FinalTie } from '@bis/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useAuth } from '../../stores/auth.ts'
import { FinalTieSection } from './FinalTieSection.tsx'

const tie = (decision: FinalTie['decision'] = null): FinalTie => ({
  roundId: 'r1',
  groups: [
    {
      place: 1,
      competitors: [
        { competitorId: 'a', backNumber: 12, names: ['Ana Cruz'] },
        { competitorId: 'b', backNumber: 31, names: ['Ben Diaz'] },
      ],
    },
  ],
  decision,
})

function show(value: FinalTie, role: Role, readOnly: boolean) {
  useAuth.setState({ user: { id: 'u1', name: 'Tester', role } })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FinalTieSection tie={value} readOnly={readOnly} isChairperson={role === Role.Chairperson} />
    </QueryClientProvider>,
  )
}

describe('a tie in the final', () => {
  it('says who shares the place, and asks the scrutineer how to settle it', async () => {
    show(tie(), Role.Scrutineer, false)
    expect(screen.getByText(/No\. 12, No\. 31 share 1st place/)).toBeInTheDocument()
    const propose = screen.getByRole('button', { name: 'Propose decision' })
    expect(propose).toBeEnabled()

    await userEvent.click(screen.getByRole('radio', { name: 'Settle it with a tie-break' }))
    expect(propose).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText(/Tie-break place of No\. 12/), '1')
    await userEvent.selectOptions(screen.getByLabelText(/Tie-break place of No\. 31/), '1')
    expect(propose).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText(/Tie-break place of No\. 31/), '2')
    expect(propose).toBeEnabled()
  })

  it('waits for the chairperson, who confirms and cannot propose', async () => {
    show(tie({ mode: 'order', order: ['b', 'a'], proposedBy: 'u2', confirmedBy: null }), Role.Chairperson, true)
    expect(screen.getByText(/Waiting for the chairperson to confirm/)).toBeInTheDocument()
    expect(screen.getByText(/Settled by a tie-break: No\. 31, then No\. 12/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Propose decision' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm tie decision' })).toBeInTheDocument()
  })
})
