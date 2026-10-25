import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateProgram, getCompetitors, getEntriesByBackNumber, getProgram, setProgramStart } from '../../mocks/api.ts'
import { renderApp } from '../../test-utils.tsx'

// The table shows skeleton rows first, so wait until real rows (with a competitor link) arrive
const rowsOf = async () => {
  const table = await screen.findByRole('table')
  await within(table).findAllByRole('link')
  return within(table).getAllByRole('row').slice(1)
}

describe('rankings page', () => {
  it('opens on Latin, E1, Junior I with the leaders ranked from 1', async () => {
    renderApp('/rankings')
    expect(await screen.findByRole('heading', { name: 'Junior I · E1 · Latin' })).toBeInTheDocument()
    expect(screen.getByLabelText('Discipline')).toHaveValue('latin')
    expect(screen.getByLabelText('Age group')).toHaveValue('junior_1')
    expect(screen.getByLabelText('Class')).toHaveValue('E1')

    const rows = await rowsOf()
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('1')
    const points = rows.map((r) => Number(within(r).getAllByRole('cell').at(-1)?.textContent))
    expect(points).toEqual([...points].sort((a, b) => b - a))
  })

  it('shows 10 rows a page and pages through the rest, ranks continuing', async () => {
    renderApp('/rankings')
    const first = await rowsOf()
    expect(first).toHaveLength(10)
    const nav = within(screen.getByRole('navigation', { name: 'Rankings pagination' }))
    expect(screen.getByText(/^1–10$/)).toBeInTheDocument()

    await userEvent.click(nav.getByRole('button', { name: 'Next page' }))
    const second = await rowsOf()
    expect(second.length).toBeGreaterThan(0)
    expect(second.length).toBeLessThanOrEqual(10)
    expect(screen.getByText(/^11–/)).toBeInTheDocument()
    // Page 2 starts after page 1's leaders, so its best rank is no better than page 1's last
    const rank = (row: HTMLElement) => Number(within(row).getAllByRole('cell')[0].textContent)
    expect(rank(second[0])).toBeGreaterThanOrEqual(rank(first[first.length - 1]))
  })

  it('goes back to page 1 when the category changes', async () => {
    renderApp('/rankings')
    await rowsOf()
    const nav = within(screen.getByRole('navigation', { name: 'Rankings pagination' }))
    await userEvent.click(nav.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText(/^11–/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'youth')
    await screen.findByRole('heading', { name: 'Youth · E1 · Latin' })
    await rowsOf()
    expect(screen.getByText(/^1–/)).toBeInTheDocument()
  })

  it('changes category with the filters and keeps it in the address', async () => {
    const router = renderApp('/rankings')
    await userEvent.selectOptions(await screen.findByLabelText('Discipline'), 'standard')
    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'youth')
    expect(await screen.findByRole('heading', { name: 'Youth · E1 · Standard' })).toBeInTheDocument()
    expect(router.state.location.search).toContain('discipline=standard')
    expect(router.state.location.search).toContain('age=youth')
  })

  it('opens a category straight from the address and ignores nonsense values', async () => {
    renderApp('/rankings?discipline=standard&age=juvenile&class=C')
    expect(await screen.findByRole('heading', { name: 'Juvenile · C · Standard' })).toBeInTheDocument()
  })

  it('falls back to the defaults for an invalid address', async () => {
    renderApp('/rankings?discipline=nope&age=nope&class=nope')
    expect(await screen.findByRole('heading', { name: 'Junior I · E1 · Latin' })).toBeInTheDocument()
  })

  it('offers only the classes that have rankings', async () => {
    renderApp('/rankings')
    await rowsOf()
    const classes = within(screen.getByLabelText('Class')).getAllByRole('option')
    expect(classes.map((o) => o.textContent)).toEqual(['E1', 'D', 'C'])
  })

  it('searches everyone in the category by name or club, and says when nothing matches', async () => {
    renderApp('/rankings')
    const first = (await rowsOf())[0]
    const name = within(first).getAllByRole('link')[0].textContent ?? ''

    await userEvent.type(screen.getByLabelText('Search'), name.split(' ')[0])
    expect((await rowsOf()).some((r) => r.textContent?.includes(name))).toBe(true)

    await userEvent.clear(screen.getByLabelText('Search'))
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz-nobody')
    expect(await screen.findByText('No competitors match "zzzz-nobody"')).toBeInTheDocument()
  })

  it('shows an empty state for a category with no rankings', async () => {
    renderApp('/rankings?discipline=latin&age=senior&class=C')
    expect(await screen.findByText('No rankings in this category yet')).toBeInTheDocument()
  })
})

describe('competitor page', () => {
  it('opens from a ranking row and shows standings and results', async () => {
    const router = renderApp('/rankings')
    const first = (await rowsOf())[0]
    const link = within(first).getAllByRole('link')[0]
    const name = link.textContent ?? ''
    await userEvent.click(first)

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/competitors\/c-\d+$/)
    expect(screen.getByRole('heading', { name: 'Rankings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument()
    expect(screen.getByText('Competitions', { selector: 'dt' })).toBeInTheDocument()
    // The leader of this category is ranked 1st in it
    const tables = await screen.findAllByRole('table')
    expect(within(tables[0]).getByText('Junior I · E1 · Latin')).toBeInTheDocument()
  })

  it('goes back to the right category from a standing row', async () => {
    const router = renderApp('/rankings')
    await userEvent.click((await rowsOf())[0])
    const [standings] = await screen.findAllByRole('table')
    await within(standings).findByText('Junior I · E1 · Latin')
    await userEvent.click(within(standings).getAllByRole('row')[1])
    expect(router.state.location.pathname).toBe('/rankings')
    expect(router.state.location.search).toMatch(/discipline=\w+&age=\w+&class=\w+/)
  })

  it('says so for a competitor that does not exist', async () => {
    renderApp('/competitors/c-nobody')
    expect(await screen.findByText('Competitor not found')).toBeInTheDocument()
  })
})

describe('public site', () => {
  it('home shows what is on the floor and the latest results', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Sorsogon Dancesport Open 2026' })).toBeInTheDocument()
    const floor = await screen.findByRole('region', { name: 'On the floor now' })
    expect(within(floor).getByText(/E11/)).toBeInTheDocument()

    const latest = await screen.findByRole('region', { name: 'Latest results' })
    const podium = await within(latest).findAllByRole('listitem')
    expect(podium.length).toBeGreaterThanOrEqual(3)
    expect(within(latest).getAllByText('1st').length).toBeGreaterThan(0)
  })

  it('goes from the competitions list to an event and its results', async () => {
    renderApp('/competitions')
    expect(await screen.findByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Sorsogon Dancesport Open 2026' }))

    // Events page 10 at a time and E12 is on the second page, so search for it
    await userEvent.type(await screen.findByLabelText('Search events'), 'E12')
    await userEvent.click(await screen.findByRole('link', { name: /E12/ }))

    expect(await screen.findByRole('heading', { name: /^E12 Rumba/ })).toBeInTheDocument()
    const table = await screen.findByRole('table')
    await within(table).findAllByRole('link')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('1st')).toBeInTheDocument()
    expect((await screen.findAllByText(/back numbers through to/)).length).toBe(2)
  })

  it('opens a competitor profile from the results', async () => {
    renderApp('/competitions/comp-sorsogon-2026/events/comp-sorsogon-2026:e12')
    const table = await screen.findByRole('table')
    const [first] = await within(table).findAllByRole('link')
    await userEvent.click(first)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('program page', () => {
  beforeAll(async () => {
    await generateProgram('test', 'comp-sorsogon-2026')
    await setProgramStart('test', 'comp-sorsogon-2026', '07:00')
  })

  const programRows = async () => {
    const table = await screen.findByRole('table')
    await within(table).findByText('7:00 AM')
    return within(table).getAllByRole('row').slice(1)
  }

  it('shows the running order with times, 10 lines a page, and what is next', async () => {
    renderApp('/competitions/comp-sorsogon-2026/program')
    expect(await screen.findByRole('heading', { name: 'Program' })).toBeInTheDocument()
    const rows = await programRows()
    expect(rows).toHaveLength(10)
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('7:00 AM')
    expect(screen.getByText(/^1–10$/)).toBeInTheDocument()

    const strip = within(screen.getByRole('region', { name: 'On the floor and up next' }))
    expect(strip.getByText('On the floor')).toBeInTheDocument()
    expect(strip.getByText('Up next')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Back$|Sorsogon/i })).toBeInTheDocument()
  })

  it('filters by round and by search', async () => {
    renderApp('/competitions/comp-sorsogon-2026/program')
    await programRows()

    await userEvent.selectOptions(screen.getByLabelText('Round'), 'final')
    await waitFor(() => {
      const table = screen.getByRole('table')
      const cells = within(table).getAllByRole('row').slice(1).map((r) => within(r).queryAllByRole('cell')[2]?.textContent)
      expect(cells.length).toBeGreaterThan(0)
      expect(cells.every((c) => c === 'Final' || c === undefined)).toBe(true)
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
    await waitFor(() => expect(screen.getByText(new RegExp(`^1–${Math.min(expected, 10)}$`))).toBeInTheDocument())
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
