import { Role } from '@bis/shared'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

const picture = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

describe('the home page picture', () => {
  it('shows on the home page once the admin has set it, and goes back when reset', async () => {
    await api.saveHeroImage('staff-admin', picture)
    const first = renderApp('/', undefined)
    await waitFor(() => expect(document.querySelector(`img[src="${picture}"]`)).not.toBeNull())
    void first

    renderApp('/admin/site', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: /Use the built-in picture/ }))
    expect(await screen.findByText('Back to the built-in picture')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Use the built-in picture/ })).not.toBeInTheDocument())
  })

  it('shows the sign-in picture on the sign-in pages once the admin has set it', async () => {
    await api.saveSignInImage('staff-admin', picture)
    renderApp('/sign-in', undefined)
    await waitFor(() => expect(document.querySelector(`img[src="${picture}"]`)).not.toBeNull())
    renderApp('/admin/site', Role.Admin)
    expect(await screen.findByRole('button', { name: /Change sign-in picture/ })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Use the built-in picture/ }))
    expect(await screen.findByText('Sign-in back to the built-in picture')).toBeInTheDocument()
  })

  it('has a Home page entry in the admin menu', async () => {
    renderApp('/admin/site', Role.Admin)
    expect(await screen.findByRole('heading', { name: 'Home page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Change hero picture/ })).toBeInTheDocument()
  })
})
