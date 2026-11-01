import { Role } from '@bis/shared'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

describe('athlete account', () => {
  it('signs up, fills in details and sends a membership payment, and the secretariat confirms it', async () => {
    renderApp('/athlete')
    expect(await screen.findByRole('heading', { name: 'Athlete sign-in' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ana Cruz')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Use a password of at least 8 characters.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Your page' })).toBeInTheDocument()
    expect(await screen.findByText('Not paid')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Contact no.'), '0917')
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Enter the reference number of your payment.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Reference number'), 'REF-1')
    await userEvent.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Waiting for the secretariat')).toBeInTheDocument()

    cleanup()
    renderApp('/secretariat/athletes', Role.Secretariat)
    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm membership of Ana Cruz' }))
    expect(await screen.findByText('Confirmed Ana Cruz')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm membership of Ana Cruz' })).not.toBeInTheDocument()
  })

  it('lets the secretariat turn a payment down with a reason', async () => {
    renderApp('/athlete')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ben Reyes')
    await userEvent.type(screen.getByLabelText('Email'), 'ben@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await userEvent.type(await screen.findByLabelText('Reference number'), 'BAD-1')
    await userEvent.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Waiting for the secretariat')).toBeInTheDocument()

    cleanup()
    renderApp('/secretariat/athletes', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn down payment of Ben Reyes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Turn down' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'No payment found')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn down' }))
    expect(await screen.findByText('Turned down the payment of Ben Reyes')).toBeInTheDocument()
    expect(await screen.findByText('Not confirmed')).toBeInTheDocument()
  })

  it('keeps an athlete out of the staff screens and staff out of the athlete page', async () => {
    renderApp('/secretariat/athletes', Role.Athlete)
    expect(await screen.findByRole('heading', { name: 'Your page' })).toBeInTheDocument()
    cleanup()
    renderApp('/athlete', Role.Secretariat)
    expect(await screen.findByRole('link', { name: 'Athletes' })).toBeInTheDocument()
  })
})
