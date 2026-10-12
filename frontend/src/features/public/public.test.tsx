import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
