import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import * as api from '../../api/index.ts'
import { renderApp } from '../../test-utils.tsx'

describe('the certificate layout page', () => {
  it('lets the scrutineer change a line and save it, and the printed certificate follows', async () => {
    renderApp('/scrutineer/certificates', Role.Scrutineer)
    await screen.findByRole('heading', { name: 'Certificates' })
    await userEvent.click(await screen.findByRole('button', { name: 'Portrait' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save layout' }))
    expect(await screen.findByText('Certificate layout saved')).toBeInTheDocument()
    await waitFor(async () => expect((await api.getCertificateLayout()).orientation).toBe('portrait'))

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
    const ask = await screen.findByRole('dialog', { name: 'Go back to the built-in layout?' })
    await userEvent.click(within(ask).getByRole('button', { name: 'Reset' }))
    expect(await screen.findByText('Back to the built-in layout')).toBeInTheDocument()
    await waitFor(async () => expect((await api.getCertificateLayout()).orientation).toBe('landscape'))
  })
})

describe('the wording field', () => {
  it('is read only, and opens an editor when clicked, with plain labels instead of braces', async () => {
    renderApp('/scrutineer/certificates', Role.Scrutineer)
    const wording = await screen.findByLabelText('Wording')
    expect(wording).toHaveAttribute('readonly')
    expect(wording).toHaveValue('Juan Dela Cruz & Maria Santos')

    await userEvent.click(wording)
    const dialog = await screen.findByRole('dialog', { name: 'Wording: Name' })
    const field = within(dialog).getByLabelText('Wording')
    expect(field).toHaveValue('[Couple]')
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Team' }))
    expect(field).toHaveValue('[Couple] [Team]')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.getByLabelText('Wording')).toHaveValue('Juan Dela Cruz & Maria Santos Naga Dance Team'))
  })
})

describe('moving the elements', () => {
  it('nudges a line with the arrow keys, and puts it back', async () => {
    renderApp('/scrutineer/certificates', Role.Scrutineer)
    const name = await screen.findByRole('button', { name: /^Move Juan Dela Cruz/ })
    expect(screen.queryByRole('button', { name: 'Reset position' })).not.toBeInTheDocument()
    name.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    expect(name.style.transform).toBe('translate(1mm, 1mm)')
    await userEvent.click(screen.getByRole('button', { name: 'Reset position' }))
    expect(name.style.transform).toBe('')
  })

  it('has a name and signature for the organizer, the chairperson and the PDSF president', async () => {
    renderApp('/scrutineer/certificates', Role.Scrutineer)
    for (const role of ['Organizer', 'Chairperson of Adjudicators', 'PDSF President']) {
      expect(await screen.findByLabelText(`${role} name`)).toBeInTheDocument()
      expect(screen.getByLabelText(`${role} signature file`)).toBeInTheDocument()
    }
  })
})
