import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Input, Table, Tabs } from './index.ts'

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
