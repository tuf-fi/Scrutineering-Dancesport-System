import { Role } from '@bis/shared'
import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test-utils.tsx'

// Staff only ever see their own screens: a public address sends them back to their own page
describe('staff on a public address', () => {
  it.each([
    [Role.Secretariat, '/', '/secretariat'],
    [Role.Admin, '/competitions', '/admin'],
    [Role.Compere, '/athletes', '/compere'],
    [Role.Scrutineer, '/standings', '/scrutineer'],
  ])('sends %s back to their own page', async (role, path, home) => {
    const router = renderApp(path, role)
    await waitFor(() => expect(router.state.location.pathname.startsWith(home)).toBe(true))
  })

  it('leaves an athlete on the public pages', async () => {
    const router = renderApp('/competitions', Role.Athlete)
    await waitFor(() => expect(router.state.location.pathname).toBe('/competitions'))
  })
})
