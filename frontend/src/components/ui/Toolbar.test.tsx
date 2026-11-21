import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar, ToolbarActions } from './Toolbar.tsx'

describe('Toolbar', () => {
  it('keeps a control beside a fragment and the controls inside it apart, so no key repeats', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Toolbar>
        <label>Round<input /></label>
        {[1].length > 0 && (
          <>
            <label>Per heat<input /></label>
            <ToolbarActions>
              <button>Split evenly</button>
            </ToolbarActions>
          </>
        )}
      </Toolbar>,
    )
    expect(screen.getByLabelText('Round')).toBeInTheDocument()
    expect(screen.getByLabelText('Per heat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Split evenly' })).toBeInTheDocument()
    const repeated = error.mock.calls.filter((c) => String(c[0]).includes('same key'))
    error.mockRestore()
    expect(repeated).toHaveLength(0)
  })
})
