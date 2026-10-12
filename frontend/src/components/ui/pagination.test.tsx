import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination.tsx'
import { Table } from './Table.tsx'

const numbers = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i + 1}`, n: i + 1 }))
const columns = [{ key: 'n', header: 'Number', cell: (r: { n: number }) => r.n }]

function NumberTable({ rows }: { rows: Array<{ id: string; n: number }> }) {
  return <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
}

const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('Pagination', () => {
  it('shows the range and total', () => {
    render(<Pagination page={2} pageSize={10} total={34} onPageChange={() => {}} />)
    expect(screen.getByText('11–20')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
  })

  it('shows 0–0 for an empty list and stays on one page', () => {
    render(<Pagination page={1} pageSize={10} total={0} onPageChange={() => {}} />)
    expect(screen.getByText('0–0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(<Pagination page={1} pageSize={10} total={25} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    rerender(<Pagination page={3} pageSize={10} total={25} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByText('21–25')).toBeInTheDocument()
  })

  it('marks the current page and reports the page that was picked', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} pageSize={10} total={40} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('collapses a long run of pages with gaps but keeps the first, last and nearby pages', () => {
    render(<Pagination page={6} pageSize={10} total={200} onPageChange={() => {}} />)
    const pages = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(pages).toEqual([
      'Previous page',
      'Page 1',
      'Page 5',
      'Page 6',
      'Page 7',
      'Page 20',
      'Next page',
    ])
  })
})

describe('Table pagination', () => {
  it('never shows more than 10 rows, and always has a pager', () => {
    render(<NumberTable rows={numbers(7)} />)
    expect(bodyRows()).toHaveLength(7)
    // Even a short list gets the pager, so the layout is the same everywhere
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByText('1–7')).toBeInTheDocument()
  })

  it('splits 25 rows into pages of 10, 10 and 5', async () => {
    render(<NumberTable rows={numbers(25)} />)
    expect(bodyRows()).toHaveLength(10)
    expect(within(bodyRows()[0]).getByText('1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(bodyRows()).toHaveLength(10)
    expect(within(bodyRows()[0]).getByText('11')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(bodyRows()).toHaveLength(5)
    expect(within(bodyRows()[0]).getByText('21')).toBeInTheDocument()
    expect(screen.getByText('21–25')).toBeInTheDocument()
  })

  it('shows exactly 10 rows when there are exactly 10, on a single page', () => {
    render(<NumberTable rows={numbers(10)} />)
    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('goes back to the first page when the rows change, as with a search', async () => {
    function Searchable() {
      const [q, setQ] = useState('')
      const rows = numbers(30).filter((r) => String(r.n).includes(q))
      return (
        <>
          <input aria-label="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
          <NumberTable rows={rows} />
        </>
      )
    }
    render(<Searchable />)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('11–20')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Filter'), '2')
    expect(screen.getByText(/^1–/)).toBeInTheDocument()
    expect(within(bodyRows()[0]).getByText('2')).toBeInTheDocument()
  })

  it('has no pager while loading and shows the empty state with no rows', () => {
    const { rerender } = render(<Table columns={columns} rows={[]} rowKey={() => ''} loading />)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    rerender(<Table columns={columns} rows={[]} rowKey={() => ''} empty={{ title: 'Nothing' }} />)
    expect(screen.getByText('Nothing')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })
})
