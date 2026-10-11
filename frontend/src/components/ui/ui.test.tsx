import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Dialog, Input, Table, Tabs, Toaster, toast } from './index.ts'

describe('Dialog', () => {
  it('shows its title and closes on Escape', async () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="Publish this result?" description="It goes public." />)
    expect(screen.getByRole('dialog', { name: 'Publish this result?' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing while closed and runs its actions', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Dialog open={false} onClose={() => {}} title="Hidden" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(
      <Dialog open onClose={() => {}} title="Shown" actions={<Button onClick={onClick}>Publish</Button>} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('Toaster', () => {
  it('shows a toast message', async () => {
    render(<Toaster />)
    act(() => void toast.success('Submitted'))
    expect(await screen.findByText('Submitted')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Submit</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Input', () => {
  it('links the visible label and error to the field', () => {
    render(<Input label="Username" error="Required" />)
    const input = screen.getByLabelText('Username')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
  })
})

describe('Table', () => {
  it('shows the empty state with no rows', () => {
    render(<Table columns={[]} rows={[]} rowKey={() => ''} empty={{ title: 'No entries' }} />)
    expect(screen.getByText('No entries')).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  it('moves selection with the arrow keys', async () => {
    function Harness() {
      const [v, setV] = useState('a')
      return <Tabs label="Dances" value={v} onChange={setV} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />
    }
    render(<Harness />)
    screen.getByRole('tab', { name: 'A' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true')
  })
})
