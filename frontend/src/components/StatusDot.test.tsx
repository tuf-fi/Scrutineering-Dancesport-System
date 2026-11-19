import { ProgramStatus } from '@bis/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusDot, StatusLegend } from './StatusDot.tsx'

const color = (name: string) => screen.getByRole('img', { name }).style.getPropertyValue('--dot')

describe('StatusDot', () => {
  it('names each status and glows red when finished, green on the floor, blue next and grey when not started', () => {
    const { rerender } = render(<StatusDot status={ProgramStatus.Completed} />)
    expect(color('Finished')).toContain('status-done')
    rerender(<StatusDot status={ProgramStatus.Current} />)
    expect(color('On the floor')).toContain('status-live')
    rerender(<StatusDot status={ProgramStatus.Next} />)
    expect(color('Up next')).toContain('status-next')
    rerender(<StatusDot status={ProgramStatus.Upcoming} />)
    expect(color('Not started')).toContain('status-idle')
  })

  it('lists all four in the legend', () => {
    render(<StatusLegend />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
