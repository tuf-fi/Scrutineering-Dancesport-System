import { Role } from '@bis/shared'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('club account', () => {
  it('changes the password', async () => {
    renderApp('/club/account', Role.Club)
    await userEvent.type(await screen.findByLabelText('Current password'), 'old-password-1')
    await userEvent.type(screen.getByLabelText('New password'), 'new-password-1')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Password changed')).toBeInTheDocument()
  })

  it('shows the privacy notice to anyone', async () => {
    renderApp('/privacy')
    expect(await screen.findByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    expect(screen.getByText(/Data Privacy Act of 2012/)).toBeInTheDocument()
    expect(screen.getByText(/deleted 90 days after the competition/)).toBeInTheDocument()
  })
})

describe('club Messenger', () => {
  it('offers the link, and disconnects after linking', async () => {
    renderApp('/club/account', Role.Club)
    const link = await screen.findByRole('link', { name: 'Connect Messenger' })
    expect(link).toHaveAttribute('href', expect.stringContaining('https://m.me/'))
  })
})
