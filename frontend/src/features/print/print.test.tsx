import { Role } from '@bis/shared'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { generateProgram, getAdjudicators, getCompetitors, getEntriesByBackNumber, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

const staff = { id: 'staff-scrutineer', name: 'Teresita Quimpo' }
const E12 = 'comp-sorsogon-2026:e12'
const E11 = 'comp-sorsogon-2026:e11'
const sheetRows = () => screen.getAllByRole('row').slice(1)

describe('printouts', () => {
  it('prints the qualified list in the layout of the paper sheet', async () => {
    renderApp(`/print/recall/${E12}?round=${E12}:round_1`, Role.Scrutineer, staff)
    expect(await screen.findByRole('heading', { name: 'Qualified Solos for the semi-final' })).toBeInTheDocument()
    expect(screen.getByText('Sorsogon Provincial Gymnasium, Sorsogon City')).toBeInTheDocument()
    // With no executor set, the sheet falls back to the organizer
    expect(screen.getAllByText('BN IT Scrutineer')).toHaveLength(2)
    expect(screen.getByText('JUN 1 - E1 [Rumba]')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Adjudicators' })).getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('columnheader', { name: 'Solo:' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Team:' })).toBeInTheDocument()
    await waitFor(() => expect(sheetRows()).toHaveLength(12))
    // Sorted by back number
    const numbers = sheetRows().map((r) => Number(within(r).getAllByRole('cell')[0].textContent))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    expect(screen.getByText(/^12 Solos\. \(Total: \d+ Solos\)/)).toBeInTheDocument()
  })

  it('prints a heat list with every heat', async () => {
    renderApp(`/print/heats/${E11}?round=${E11}:round_2`, Role.Scrutineer, staff)
    expect(await screen.findByRole('heading', { name: 'Heat list: Round 2' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Heat 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heat 2' })).toBeInTheDocument()
    expect(screen.getByText(/in 2 heats\./)).toBeInTheDocument()
  })

  it('prints a scores sheet with every adjudicator and the majority columns', async () => {
    renderApp(`/print/scores/${E12}?round=${E12}:final`, Role.Scrutineer, staff)
    expect(await screen.findByRole('heading', { name: 'Scores sheet: Final' })).toBeInTheDocument()
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      expect(await screen.findByRole('columnheader', { name: letter })).toBeInTheDocument()
    }
    expect(screen.getByRole('columnheader', { name: '1-6' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument()
    await waitFor(() => expect(sheetRows()).toHaveLength(6))
  })

  it('prints the final results with signature lines for the scrutineer and the chairperson', async () => {
    renderApp(`/print/results/${E12}`, Role.Scrutineer, staff)
    expect(await screen.findByRole('heading', { name: 'Final results' }, { timeout: 4000 })).toBeInTheDocument()
    await waitFor(() => expect(sheetRows()).toHaveLength(6))
    expect(within(sheetRows()[0]).getByText('1st')).toBeInTheDocument()
    expect(screen.getByText('Scrutineer')).toBeInTheDocument()
    expect(screen.getByText('Chairperson of Adjudicators')).toBeInTheDocument()
  })

  it('prints one blank mark sheet per adjudicator, numbers filled in', async () => {
    renderApp(`/print/blank-sheets/${E11}?round=${E11}:round_2`, Role.Scrutineer, staff)
    const sheets = await screen.findAllByRole('heading', { name: 'Adjudicator mark sheet: Round 2' })
    expect(sheets).toHaveLength(7)
    expect(screen.getAllByText('Mark an X for exactly 12 competitors in each dance.')).toHaveLength(7)
  })

  it('lists every sheet on the printouts page, opening each in a new tab', async () => {
    renderApp('/print', Role.Scrutineer, staff)
    const list = await screen.findByRole('list', { name: 'Sheets' })
    // The program sheet is for a whole competition, so it appears once the competition is known
    await within(list).findByRole('link', { name: /^Program/ })
    const links = within(list).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Program'),
      expect.stringContaining('Heat list'),
      expect.stringContaining('Qualified list'),
      expect.stringContaining('Scores sheet'),
      expect.stringContaining('Final results'),
      expect.stringContaining('Blank mark sheets'),
    ])
    for (const link of links) expect(link).toHaveAttribute('target', '_blank')
  })
})

describe('program printout', () => {
  const COMP = 'comp-sorsogon-2026'
  beforeAll(async () => {
    await generateProgram('test', COMP)
    await setProgramStart('test', COMP, '07:00')
  })

  it('prints every line, not 10 a page, for a guest', async () => {
    renderApp(`/competitions/${COMP}/program/print`)
    expect(await screen.findByRole('heading', { name: /^Program: / })).toBeInTheDocument()
    await screen.findByText('7:00 AM')
    expect(sheetRows().length).toBeGreaterThan(10)
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
    expect(screen.getByText(/^Printed$/)).toBeInTheDocument()
    expect(screen.getByText(`${sheetRows().length} lines.`)).toBeInTheDocument()
  })

  it('keeps the search and round filter, and says so', async () => {
    renderApp(`/competitions/${COMP}/program/print?round=final`)
    await screen.findByText(/filtered by Final\./)
    const rows = sheetRows()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('Final')
    expect(screen.getByText(/filtered by Final\.$/)).toBeInTheDocument()
  })

  it('prints only the events of a back number and says so', async () => {
    let number = 0
    for (const c of await getCompetitors()) {
      if (c.backNumber !== null && (await getEntriesByBackNumber(COMP, c.backNumber)).length > 0) {
        number = c.backNumber
        break
      }
    }
    renderApp(`/competitions/${COMP}/program/print?back=${number}`)
    await screen.findByText(/filtered by back number/)
    expect(screen.getByText(/filtered by back number/).textContent).toMatch(new RegExp(`back number ${number}[.]$`))
    expect(sheetRows().length).toBeGreaterThan(0)
  })

  it('opens the print dialog at once for the PDF link', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderApp(`/competitions/${COMP}/program/print?pdf=1`)
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(screen.getByText('In the print dialog, choose Save as PDF as the destination.')).toBeInTheDocument()
    print.mockRestore()
  })
})

describe('PIN cards', () => {
  const admin = { id: 'staff-admin', name: 'Amelia Rosales' }

  it('prints a card for every adjudicator with a PIN and a QR code that carries it after a #', async () => {
    renderApp('/print/pin-cards/comp-sorsogon-2026', Role.Admin, admin)
    const list = await screen.findByRole('list', { name: 'PIN cards' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards.length).toBeGreaterThan(5)
    expect(within(cards[0]!).getByText('410000')).toBeInTheDocument()
    const qr = await within(cards[0]!).findByRole('img', { name: /^Sign-in code for / })
    const svg = decodeURIComponent(qr.getAttribute('src')!.replace('data:image/svg+xml;utf8,', ''))
    expect(svg).toContain('<svg')
  })

  it('prints only the cards that were chosen', async () => {
    renderApp('/print/pin-cards/comp-sorsogon-2026', Role.Admin, admin)
    const all = within(await screen.findByRole('list', { name: 'PIN cards' })).getAllByRole('listitem')
    expect(all.length).toBeGreaterThan(2)
    cleanup()

    // Any two adjudicator ids that have cards
    const ids = (await getAdjudicators()).slice(0, 2).map((x) => x.id)
    renderApp(`/print/pin-cards/comp-sorsogon-2026?ids=${ids.join(',')}`, Role.Admin, admin)
    const chosen = within(await screen.findByRole('list', { name: 'PIN cards' })).getAllByRole('listitem')
    expect(chosen).toHaveLength(2)
  })

  it('says so when no PINs exist yet', async () => {
    renderApp('/print/pin-cards/comp-legazpi-2026', Role.Admin, admin)
    expect(await screen.findByText('No PINs yet')).toBeInTheDocument()
  })
})
