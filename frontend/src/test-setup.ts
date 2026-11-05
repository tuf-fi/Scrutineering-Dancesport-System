import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// The fake API waits 250ms per call and role queries are slow on big pages, so allow more than 1s
configure({ asyncUtilTimeout: 8000 })

afterEach(cleanup)

// jsdom cannot decode a picture, so the resizing helpers hand back a small stand-in picture
vi.mock('./lib/image.ts', () => {
  const picture = async () => 'data:image/png;base64,iVBORw0KGgo='
  return { squarePhoto: picture, coverPhoto: picture, screenshotImage: picture }
})

// jsdom has no canvas: the signature pad draws nothing and reports a tiny PNG
HTMLCanvasElement.prototype.getContext = (() => null) as never
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo='
