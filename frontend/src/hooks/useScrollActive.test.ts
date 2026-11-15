import { describe, expect, it } from 'vitest'
import { scrollActiveIntoView } from './useScrollActive.ts'

// jsdom has no layout, so the boxes are given by hand
const box = (top: number, bottom: number, left = 0, right = 100) => ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function nav(link: DOMRect, area: DOMRect) {
  const list = document.createElement('nav')
  const active = document.createElement('a')
  active.setAttribute('aria-current', 'page')
  list.append(active)
  // jsdom ignores scrolling, so the offsets are plain numbers here
  Object.defineProperty(list, 'scrollTop', { value: 0, writable: true })
  Object.defineProperty(list, 'scrollLeft', { value: 0, writable: true })
  list.getBoundingClientRect = () => area
  active.getBoundingClientRect = () => link
  return list
}

describe('scrolling the current link into view', () => {
  it('scrolls a long sidebar down to a link below the fold, and back up to one above it', () => {
    const below = nav(box(900, 940), box(100, 600))
    scrollActiveIntoView(below)
    expect(below.scrollTop).toBe(340 + 12)

    const above = nav(box(20, 60), box(100, 600))
    above.scrollTop = 500
    scrollActiveIntoView(above)
    expect(above.scrollTop).toBe(500 - 80 - 12)
  })

  it('scrolls a strip of tabs sideways to a link past its edge', () => {
    const strip = nav(box(0, 40, 380, 520), box(0, 40, 0, 360))
    scrollActiveIntoView(strip)
    expect(strip.scrollLeft).toBe(160 + 12)
  })

  it('leaves a link that is already in view alone, and copes with no current link', () => {
    const fine = nav(box(150, 190), box(100, 600))
    scrollActiveIntoView(fine)
    expect(fine.scrollTop).toBe(0)
    expect(() => scrollActiveIntoView(document.createElement('nav'))).not.toThrow()
    expect(() => scrollActiveIntoView(null)).not.toThrow()
  })
})
