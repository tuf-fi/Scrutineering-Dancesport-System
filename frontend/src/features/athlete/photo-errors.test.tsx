import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/http.ts'
import { renderApp } from '../../test-utils.tsx'

// The server refuses the sign-up as too big
vi.mock('../../api/index.ts', async (original) => ({
  ...(await original<typeof import('../../api/index.ts')>()),
  signUpAthlete: () => Promise.reject(new ApiError(413, 'The file exceeded the maximum size.')),
}))

describe('sign-up photo', () => {
  it('says what pictures are accepted, and shows a too-big picture in the photo section, not under the password', async () => {
    renderApp('/athlete')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    expect(screen.getByText('JPEG, PNG or WebP, up to 10 MB. It is cropped to a square.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Full name'), 'Ana Lim')
    await userEvent.upload(screen.getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByText('The image exceeded the maximum size.')
    expect(alert).toHaveAttribute('role', 'alert')
    const form = alert.closest('form')!
    expect(within(form).queryByText(/Payload|exceeded the maximum size\.$/, { selector: 'p:not([role="alert"])' })).not.toBeInTheDocument()
    expect(screen.queryByText('The file exceeded the maximum size.')).not.toBeInTheDocument()
  })
})
