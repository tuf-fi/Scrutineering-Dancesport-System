import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateProgram, getBicolAthleteIds, getCompetitors, getEntriesByBackNumber, getProgram, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

// The table shows skeleton rows first, so wait until real rows (with a competitor link) arrive
const rowsOf = async () => {
  const list = await screen.findByRole('list', { name: 'Standings' })
  await within(list).findAllByRole('link')
  return within(list).getAllByRole('listitem')
}

describe('rankings page', () => {
  it('opens on Latin, E1, Junior I with the leaders ranked from 1', async () => {
    renderApp('/standings')
    expect(await screen.findByRole('heading', { name: 'Junior I · E1 · Latin' })).toBeInTheDocument()
    expect(screen.getByLabelText('Discipline')).toHaveValue('latin')
    expect(screen.getByLabelText('Age group')).toHaveValue('junior_1')
    expect(screen.getByLabelText('Class')).toHaveValue('E1')

    const rows = await rowsOf()
    expect(rows[0]).toHaveTextContent(/^01/)
    const points = rows.map((r) => Number(r.querySelector('span.tabular-nums:not(.font-mono)')?.textContent))
    expect(points).toEqual([...points].sort((a, b) => b - a))
  })

  it('opens on the page that holds the highlighted row, and marks it', async () => {
    renderApp('/standings')
    await rowsOf()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Standings pagination' })).getByRole('button', { name: 'Next page' }))
    const [onSecondPage] = await rowsOf()
    const id = onSecondPage!.getAttribute('data-row')
    expect(id).toBeTruthy()
    cleanup()

    renderApp(`/standings?highlight=${id}`)
    await waitFor(() => expect(screen.getByText(/^11–/)).toBeInTheDocument())
    const row = document.querySelector(`[data-row="${id}"]`)
    expect(row).not.toBeNull()
    expect(row?.className).toContain('bg-gold-50')
  })

  it('shows 10 rows a page and pages through the rest, ranks continuing', async () => {
    renderApp('/standings')
    const first = await rowsOf()
    expect(first).toHaveLength(10)
    const nav = within(screen.getByRole('navigation', { name: 'Standings pagination' }))
    expect(screen.getByText(/^1–10$/)).toBeInTheDocument()

    await userEvent.click(nav.getByRole('button', { name: 'Next page' }))
    const second = await rowsOf()
    expect(second.length).toBeGreaterThan(0)
    expect(second.length).toBeLessThanOrEqual(10)
    expect(screen.getByText(/^11–/)).toBeInTheDocument()
    // Page 2 starts after page 1's leaders, so its best rank is no better than page 1's last
    const rank = (row: HTMLElement) => parseInt(row.textContent ?? '', 10)
    expect(rank(second[0])).toBeGreaterThanOrEqual(rank(first[first.length - 1]))
  })

  it('goes back to page 1 when the category changes', async () => {
    renderApp('/standings')
    await rowsOf()
    const nav = within(screen.getByRole('navigation', { name: 'Standings pagination' }))
    await userEvent.click(nav.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText(/^11–/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'youth')
    await screen.findByRole('heading', { name: 'Youth · E1 · Latin' })
    await rowsOf()
    expect(screen.getByText(/^1–/)).toBeInTheDocument()
  })

  it('changes category with the filters and keeps it in the address', async () => {
    const router = renderApp('/standings')
    await userEvent.selectOptions(await screen.findByLabelText('Discipline'), 'standard')
    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'youth')
    expect(await screen.findByRole('heading', { name: 'Youth · E1 · Standard' })).toBeInTheDocument()
    expect(router.state.location.search).toContain('discipline=standard')
    expect(router.state.location.search).toContain('age=youth')
  })

  it('opens a category straight from the address and ignores nonsense values', async () => {
    renderApp('/standings?discipline=standard&age=juvenile_1&class=C')
    expect(await screen.findByRole('heading', { name: 'Juvenile 1 · C · Standard' })).toBeInTheDocument()
  })

  it('falls back to the defaults for an invalid address', async () => {
    renderApp('/standings?discipline=nope&age=nope&class=nope')
    expect(await screen.findByRole('heading', { name: 'Junior I · E1 · Latin' })).toBeInTheDocument()
  })

  it('offers only the age groups that have standings', async () => {
    renderApp('/standings')
    await rowsOf()
    const names = within(screen.getByLabelText('Age group')).getAllByRole('option').map((o) => o.textContent)
    // The sample has points in every group but Juvenile 2, so that one is not offered
    expect(names).toContain('Junior I')
    expect(names).not.toContain('Juvenile 2')
  })

  it('offers only the classes that have rankings', async () => {
    renderApp('/standings')
    await rowsOf()
    const classes = within(screen.getByLabelText('Class')).getAllByRole('option')
    expect(classes.map((o) => o.textContent)).toEqual(['E1', 'D', 'C'])
  })

  it('searches everyone in the category by name or team, and says when nothing matches', async () => {
    renderApp('/standings')
    const first = (await rowsOf())[0]
    const name = within(first).getAllByRole('link')[0].textContent ?? ''

    await userEvent.type(screen.getByLabelText('Search'), name.split(' ')[0])
    expect((await rowsOf()).some((r) => r.textContent?.includes(name))).toBe(true)

    await userEvent.clear(screen.getByLabelText('Search'))
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz-nobody')
    expect(await screen.findByText('No competitors match "zzzz-nobody"')).toBeInTheDocument()
  })

  it('shows an empty state for a category with no rankings', async () => {
    renderApp('/standings?discipline=latin&age=senior&class=C')
    expect(await screen.findByText('No standings in this category yet')).toBeInTheDocument()
  })
})

describe('competitor page', () => {
  it('opens from a ranking row and shows standings and results', async () => {
    const router = renderApp('/standings')
    const first = (await rowsOf())[0]
    const link = within(first).getAllByRole('link')[0]
    const name = link.textContent ?? ''
    await userEvent.click(link)

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/competitors\/c-\d+$/)
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument()
    expect(screen.getByText('Competitions', { selector: 'dt' })).toBeInTheDocument()
    // The leader of this category is ranked 1st in it
    expect(await screen.findByRole('link', { name: 'Junior I · E1 · Latin' })).toBeInTheDocument()
  })

  it('goes back to the right category from a standing row', async () => {
    const router = renderApp('/standings')
    await userEvent.click(within((await rowsOf())[0]).getAllByRole('link')[0])
    await userEvent.click(await screen.findByRole('link', { name: 'Junior I · E1 · Latin' }))
    expect(router.state.location.pathname).toBe('/standings')
    expect(router.state.location.search).toMatch(/discipline=\w+&age=\w+&class=\w+/)
  })

  it('says so for a competitor that does not exist', async () => {
    renderApp('/competitors/c-nobody')
    expect(await screen.findByText('Competitor not found')).toBeInTheDocument()
  })
})

describe('public site', () => {
  it('goes from the competitions list to an event and its results', async () => {
    renderApp('/competitions')
    expect(await screen.findByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Sorsogon Dancesport Open 2026' }))

    // Events page 10 at a time and E12 is on the second page, so search for it
    await userEvent.type(await screen.findByLabelText('Search events'), 'E12')
    await userEvent.click(await screen.findByRole('link', { name: /E12/ }))

    expect(await screen.findByRole('heading', { name: /^E12 Rumba/ })).toBeInTheDocument()
    // The sheet's parts, with the placings in the first
    for (const part of ['Competition report', 'Competition listing', 'Ranking report', 'Report of final round']) {
      expect(await screen.findByText(part)).toBeInTheDocument()
    }
    expect((await screen.findAllByText('1st')).length).toBeGreaterThan(0)
  })

  it('goes from Results to a competition and then to the results of an event', async () => {
    renderApp('/results')
    expect(await screen.findByRole('heading', { name: 'Results' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Sorsogon Dancesport Open 2026' }))
    expect(await screen.findByRole('heading', { name: 'Event results' })).toBeInTheDocument()
    // Only events with published results are listed, and there is no program button
    expect(screen.queryByRole('link', { name: /Program and running order/ })).not.toBeInTheDocument()
    await userEvent.type(await screen.findByLabelText('Search events'), 'E12')
    await userEvent.click(await screen.findByRole('link', { name: /E12/ }))
    expect(await screen.findByRole('heading', { name: /^E12 Rumba/ })).toBeInTheDocument()
  })

  it('keeps the old rankings address working by sending it to the standings', async () => {
    renderApp('/rankings?discipline=latin')
    expect(await screen.findByRole('heading', { name: 'Standings' })).toBeInTheDocument()
  })

  it('lists on Bicol Athletes only the competitors the server says qualify', async () => {
    renderApp('/athletes')
    expect(await screen.findByRole('heading', { name: 'Bicol Athletes' })).toBeInTheDocument()
    const listed = new Set(await getBicolAthleteIds())
    const list = await screen.findByRole('list', { name: 'Bicol athletes' })
    const links = await within(list).findAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(listed.has(link.getAttribute('href')!.split('/').pop()!)).toBe(true)
  })

  it('opens an athlete from Bicol Athletes and shows their competitions, events and placings', async () => {
    const router = renderApp('/athletes')
    const [link] = await within(await screen.findByRole('list', { name: 'Bicol athletes' })).findAllByRole('link')
    const name = link.textContent ?? ''
    await userEvent.click(link)

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/competitors\/c-\d+$/)
    const results = await screen.findByRole('list', { name: 'Results' })
    const [competition] = await within(results).findAllByRole('button', { expanded: false })
    await userEvent.click(competition)
    const events = await screen.findByRole('list', { name: /^Results at / })
    const [row] = within(events).getAllByRole('listitem')
    expect(row).toHaveTextContent(/E\d+/)
    expect(row).toHaveTextContent(/\d+(st|nd|rd|th)|Semi-final|Quarter-final|Round/)
    expect(row).toHaveTextContent(/pts/)
  })

  it('opens a competitor profile from the results', async () => {
    renderApp('/competitions/comp-sorsogon-2026/events/comp-sorsogon-2026:e12')
    await screen.findByText('Competition report')
    await waitFor(() => expect(document.querySelector('a[href^="/competitors/"]')).not.toBeNull())
    await userEvent.click(document.querySelector('a[href^="/competitors/"]')!)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('program page', () => {
  beforeAll(async () => {
    await generateProgram('test', 'comp-sorsogon-2026')
    await setProgramStart('test', 'comp-sorsogon-2026', '07:00')
  })

  const programRows = async () => {
    const list = await screen.findByRole('list', { name: 'Running order' })
    await within(list).findByText('7:00 AM')
    return within(list).getAllByRole('listitem')
  }

  it('shows the running order with times, 10 lines a page, and what is next', async () => {
    renderApp('/competitions/comp-sorsogon-2026/program')
    expect(await screen.findByRole('heading', { name: 'Program' })).toBeInTheDocument()
    const rows = await programRows()
    expect(rows).toHaveLength(10)
    expect(rows[0]).toHaveTextContent('7:00 AM')
    expect(screen.getByText(/^1–10$/)).toBeInTheDocument()

    // Sorsogon was held on an earlier day, so nothing is on the floor
    expect(screen.queryByRole('region', { name: 'On the floor and up next' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Back$|Sorsogon/i })).toBeInTheDocument()
  })

  it('filters by round and by search', async () => {
    renderApp('/competitions/comp-sorsogon-2026/program')
    await programRows()

    await userEvent.selectOptions(screen.getByLabelText('Round'), 'final')
    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Running order' })).getAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((r) => r.textContent?.includes('Final'))).toBe(true)
    })
    await userEvent.selectOptions(screen.getByLabelText('Round'), 'all')

    await userEvent.type(screen.getByLabelText('Search program'), 'nothing-matches-this')
    expect(await screen.findByText('No lines match')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await programRows()).toHaveLength(10)
    expect(screen.getByLabelText('Search program')).toHaveValue('')
  })

  it('offers Print and PDF that carry the search and round to the printout', async () => {
    renderApp('/competitions/comp-sorsogon-2026/program')
    await programRows()
    expect(screen.getByRole('link', { name: 'Print' })).toHaveAttribute('href', '/competitions/comp-sorsogon-2026/program/print')
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/competitions/comp-sorsogon-2026/program/print?pdf=1')

    await userEvent.type(screen.getByLabelText('Search program'), 'Samba')
    await userEvent.selectOptions(screen.getByLabelText('Round'), 'final')
    expect(screen.getByRole('link', { name: 'Print' })).toHaveAttribute('href', '/competitions/comp-sorsogon-2026/program/print?q=Samba&round=final')
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('target', '_blank')
  })

  it('shows only the events of a back number, keeps it in the printout link, and clears with the filters', async () => {
    // A back number that is entered in some events but not all of them
    let chosen = { number: 0, events: [] as string[] }
    for (const c of await getCompetitors()) {
      if (c.backNumber === null) continue
      const events = await getEntriesByBackNumber('comp-sorsogon-2026', c.backNumber)
      if (events.length > 0 && events.length < 5) {
        chosen = { number: c.backNumber, events }
        break
      }
    }
    expect(chosen.number).toBeGreaterThan(0)
    const program = await getProgram('comp-sorsogon-2026')
    const expected = program.rows.filter((r) => r.eventId !== null && chosen.events.includes(r.eventId)).length

    renderApp('/competitions/comp-sorsogon-2026/program')
    await programRows()
    await userEvent.type(screen.getByLabelText('Back number'), String(chosen.number))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Running order' })).getAllByRole('listitem')).toHaveLength(Math.min(expected, 10)))
    expect(screen.getByRole('link', { name: 'Print' })).toHaveAttribute('href', `/competitions/comp-sorsogon-2026/program/print?back=${chosen.number}`)

    await userEvent.clear(screen.getByLabelText('Back number'))
    await userEvent.type(screen.getByLabelText('Back number'), '999999')
    expect(await screen.findByText('No lines match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Back number')).toHaveValue('')
    expect(await programRows()).toHaveLength(10)
  })

  it('says so when a competition has no program yet', async () => {
    renderApp('/competitions/comp-legazpi-2026/program')
    expect(await screen.findByText('No program yet')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'On the floor and up next' })).not.toBeInTheDocument()
  })
})
