import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { renderApp } from '../../test-utils.tsx'

// The sample app's authenticator always shows 123456. Each test uses its own account, as the sample data is shared.

const CODE = '123456'

describe('the security page', () => {
  it('turns two-step sign-in on with a code, shows the recovery codes once, then shows it is on', async () => {
    renderApp('/secretariat/security', Role.Secretariat, { id: 'staff-secretariat', name: 'Jonas Bellosillo' })
    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument()
    expect(await screen.findByText(/^Off\./)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }))
    const dialog = await screen.findByRole('dialog', { name: 'Turn on two-step sign-in' })
    expect(await within(dialog).findByText('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBeInTheDocument()
    expect(await within(dialog).findByRole('img', { name: /add the account/i })).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Code'), '000000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn on' }))
    expect(await within(dialog).findByText(/That code is not right/)).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText('Code'))
    await userEvent.type(within(dialog).getByLabelText('Code'), CODE)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn on' }))
    const codes = await within(dialog).findByRole('list', { name: 'Recovery codes' })
    expect(within(codes).getAllByRole('listitem')).toHaveLength(8)
    await userEvent.click(within(dialog).getByRole('button', { name: 'I have saved them' }))

    expect(await screen.findByText(/^On\. After your password/)).toBeInTheDocument()
    expect(screen.getByText('8 recovery codes left.')).toBeInTheDocument()
  })

  it('turns it off only with the password and a code', async () => {
    await api.startTotpSetup('staff-chairperson')
    await api.confirmTotpSetup('staff-chairperson', CODE)
    renderApp('/scrutineer/security', Role.Chairperson, { id: 'staff-chairperson', name: 'Gregorio Almazan' })
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }))
    const dialog = await screen.findByRole('dialog', { name: 'Turn off two-step sign-in?' })

    await userEvent.type(within(dialog).getByLabelText('Password'), 'wrong')
    await userEvent.type(within(dialog).getByLabelText(/^Code from your app/), CODE)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }))
    expect(await within(dialog).findByText('The password is not right.')).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText('Password'))
    await userEvent.type(within(dialog).getByLabelText('Password'), 'bis2026')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }))
    expect(await screen.findByText('Two-step sign-in is off')).toBeInTheDocument()
    expect(await screen.findByText(/^Off\./)).toBeInTheDocument()
  })
})

describe('signing in with two-step on', () => {
  it('asks for the code after the password, refuses a wrong one, and signs in with the right one', async () => {
    await api.startTotpSetup('staff-scrutineer')
    await api.confirmTotpSetup('staff-scrutineer', CODE)
    const router = renderApp('/staff-access')
    await userEvent.type(await screen.findByLabelText('Email'), 'scrutineer@sample.example')
    await userEvent.type(screen.getByLabelText('Password'), 'bis2026')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const code = await screen.findByLabelText(/^Code from your app/)
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await userEvent.type(code, '999999')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('That code is not right.')).toBeInTheDocument()

    await userEvent.clear(code)
    await userEvent.type(code, CODE)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/scrutineer'))
    expect(useAuth.getState().user?.role).toBe(Role.Scrutineer)
  })

  it('goes back to the password step', async () => {
    await api.startTotpSetup('staff-mc')
    await api.confirmTotpSetup('staff-mc', CODE)
    renderApp('/staff-access')
    await userEvent.type(await screen.findByLabelText('Email'), 'mc@sample.example')
    await userEvent.type(screen.getByLabelText('Password'), 'bis2026')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByLabelText(/^Code from your app/)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
  })
})

describe('the admin resetting it', () => {
  it('shows who has it on, and switches it off for someone who lost their phone', async () => {
    // The first test above left it on for the secretariat account
    renderApp('/admin/staff', Role.Admin, { id: 'staff-admin', name: 'Amelia Rosales' })
    const row = await screen.findByRole('row', { name: /Jonas Bellosillo/ })
    expect(within(row).getByText('On')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Reset two-step sign-in for Jonas Bellosillo' }))
    const dialog = await screen.findByRole('dialog', { name: /Reset two-step sign-in for Jonas Bellosillo/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(await screen.findByText('Two-step sign-in is off for Jonas Bellosillo')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('row', { name: /Jonas Bellosillo/ })).queryByRole('button', { name: /Reset two-step/ })).not.toBeInTheDocument())
  })
})
