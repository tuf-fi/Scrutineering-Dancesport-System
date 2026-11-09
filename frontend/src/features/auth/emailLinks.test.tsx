import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('forgot password', () => {
  it('is offered on the sign-in page and says the same thing whatever the email is', async () => {
    renderApp('/login?as=coach')
    const link = await screen.findByRole('link', { name: 'Forgot password?' })
    expect(link).toHaveAttribute('href', '/forgot-password?as=coach')
    await userEvent.click(link)

    expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'nobody@test.example')
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    expect(await screen.findByText(/If that email has an account, we sent a link/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login?as=coach')
  })

  it('lets the emailed link choose a new password, then asks to sign in with it', async () => {
    renderApp('/reset-password?token=abc')
    await userEvent.type(await screen.findByLabelText('New password'), 'A-long-password1')
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Your password is changed. Sign in with the new one.')).toBeInTheDocument()
  })
})

describe('confirming an email address', () => {
  it('confirms as soon as the emailed link opens', async () => {
    renderApp('/verify-email?token=abc')
    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your account' })).toBeInTheDocument()
  })

  it('says so when the link has no token', async () => {
    renderApp('/verify-email')
    expect(await screen.findByText('This link is not valid. Ask for a new one.')).toBeInTheDocument()
  })
})
