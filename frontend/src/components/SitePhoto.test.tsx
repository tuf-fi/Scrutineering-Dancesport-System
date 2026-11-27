import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/index.ts'
import { HERO_IMAGE } from '../lib/hero.ts'
import { SitePhoto } from './SitePhoto.tsx'

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}>
      <SitePhoto which="heroImage" className="photo" />
    </QueryClientProvider>,
  )
const photo = () => document.querySelector('img')

describe('SitePhoto', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows no picture while the settings are loading', () => {
    vi.spyOn(api, 'getSiteSettings').mockReturnValue(new Promise(() => {}))
    show()
    expect(photo()).toBeNull()
  })

  it("shows only the admin's picture, fading it in once downloaded", async () => {
    vi.spyOn(api, 'getSiteSettings').mockResolvedValue({ heroImage: '/uploaded.jpg', signInImage: null })
    show()
    await waitFor(() => expect(photo()).toHaveAttribute('src', '/uploaded.jpg'))
    expect(photo()).toHaveClass('opacity-0')
    fireEvent.load(photo()!)
    expect(photo()).toHaveClass('opacity-80')
  })

  it('shows the built-in picture once the server says there is no upload', async () => {
    vi.spyOn(api, 'getSiteSettings').mockResolvedValue({ heroImage: null, signInImage: null })
    show()
    await waitFor(() => expect(photo()).toHaveAttribute('src', HERO_IMAGE))
  })

  it('retries three times and shows no picture when every try fails', async () => {
    const get = vi.spyOn(api, 'getSiteSettings').mockRejectedValue(new Error('down'))
    show()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4))
    expect(photo()).toBeNull()
  })

  it("shows the admin's picture when a retry succeeds", async () => {
    vi.spyOn(api, 'getSiteSettings').mockRejectedValueOnce(new Error('down')).mockResolvedValue({ heroImage: '/uploaded.jpg', signInImage: null })
    show()
    await waitFor(() => expect(photo()).toHaveAttribute('src', '/uploaded.jpg'))
  })

  it('keeps asking after the first tries fail, and shows the picture once the server answers', async () => {
    vi.useFakeTimers()
    const get = vi.spyOn(api, 'getSiteSettings').mockRejectedValue(new Error('down'))
    show()
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(get.mock.calls.length).toBeGreaterThan(4)
    expect(photo()).toBeNull()
    get.mockResolvedValue({ heroImage: '/uploaded.jpg', signInImage: null })
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(photo()).toHaveAttribute('src', '/uploaded.jpg')
  })

  it('tries a failed picture download again', async () => {
    vi.useFakeTimers()
    vi.spyOn(api, 'getSiteSettings').mockResolvedValue({ heroImage: '/uploaded.jpg', signInImage: null })
    show()
    await act(() => vi.advanceTimersByTimeAsync(100))
    fireEvent.error(photo()!)
    expect(photo()).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(photo()).toHaveAttribute('src', '/uploaded.jpg')
  })
})
