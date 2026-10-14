import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Role } from '@bis/shared'
import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/http.ts'
import { closePhoneDb, loadPending, loadSent, saveSent } from '../../lib/phoneDb.ts'
import { COOLDOWN_MS, forgetSentThisSession, lostMarksToResend } from '../../lib/recoverSent.ts'
import { renderApp } from '../../test-utils.tsx'
import { useConnection } from '../../stores/connection.ts'
import { useOutbox } from '../../stores/outbox.ts'

// Each test decides how the server answers the adjudicator's marks
const send = vi.hoisted(() => vi.fn())

vi.mock('../../api/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../mocks/api.ts')>()
  return { ...original, submitAdjudicatorMarks: (...args: unknown[]) => send(...args) }
})

const adjudicator = { id: 'adj-a', name: 'Lorenzo V. Aguilar', letter: 'A' }
const ROUND = 'comp-sorsogon-2026:e11:round_2'

async function holdMarks() {
  await useOutbox.getState().save({ adjudicatorId: 'adj-a', roundId: ROUND, submissions: [{ dance: 'cha_cha_cha', competitorIds: ['c1'] }] })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  closePhoneDb()
  useOutbox.setState({ pending: null })
  useConnection.setState({ online: true })
  send.mockReset()
  forgetSentThisSession()
})

describe('marks saved on the phone', () => {
  it('go out as soon as the screen opens, and are forgotten once the server has them', async () => {
    send.mockResolvedValue(undefined)
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send).toHaveBeenCalledWith('adj-a', ROUND, [{ dance: 'cha_cha_cha', competitorIds: ['c1'] }])
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
    expect(await loadPending()).toBeNull()
  })

  it('stay saved while the Wi-Fi is down, and go out when it returns', async () => {
    send.mockRejectedValueOnce(new ApiError(0, 'Cannot reach the venue server. Check the Wi-Fi.')).mockResolvedValue(undefined)
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))

    // What the app does when a request cannot reach the server
    act(() => useConnection.setState({ online: false }))
    expect(useOutbox.getState().pending).not.toBeNull()
    expect(await loadPending()).not.toBeNull()
    expect(await screen.findByRole('heading', { name: 'Saved, sending…' })).toBeInTheDocument()

    act(() => useConnection.setState({ online: true }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
  })

  it('stay saved when the server has trouble or the phone needs signing in again', async () => {
    send.mockRejectedValue(new ApiError(500, 'Something went wrong on the server.'))
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 100))
    expect(useOutbox.getState().pending).not.toBeNull()
    expect(await loadPending()).not.toBeNull()

    send.mockReset()
    send.mockRejectedValue(new ApiError(401, 'Sign in first.'))
    act(() => useConnection.setState({ online: false }))
    act(() => useConnection.setState({ online: true }))
    await waitFor(() => expect(send).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 100))
    expect(await loadPending()).not.toBeNull()
  })

  it('are dropped, with a message, when the server refuses them for good', async () => {
    send.mockRejectedValue(new ApiError(409, 'This round is not open for marking.'))
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    expect(await screen.findByText(/Your marks could not be sent: This round is not open for marking/)).toBeInTheDocument()
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
    expect(await loadPending()).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('are not sent by a different adjudicator who signs in on the same phone', async () => {
    send.mockResolvedValue(undefined)
    await holdMarks()
    renderApp('/adjudicator/waiting', Role.Adjudicator, { id: 'adj-b', name: 'Patricia M. Dizon', letter: 'B' })
    await new Promise((r) => setTimeout(r, 200))
    expect(send).not.toHaveBeenCalled()
    expect(await loadPending()).not.toBeNull()
  })

  it('come back after the browser was closed and are sent on the next visit', async () => {
    await holdMarks()
    // The browser is closed: memory is lost, storage is kept
    closePhoneDb()
    useOutbox.setState({ pending: null })
    send.mockResolvedValue(undefined)
    await useOutbox.getState().restore()
    expect(useOutbox.getState().pending).toMatchObject({ roundId: ROUND })
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
  })
})

describe('marks the server acknowledged', () => {
  it('are kept as a copy on the phone', async () => {
    send.mockResolvedValue(undefined)
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
    expect((await loadSent('adj-a', ROUND))!.submissions).toEqual([{ dance: 'cha_cha_cha', competitorIds: ['c1'] }])
  })

  it('are sent again when the server says they were never submitted: it was restored from an older backup', async () => {
    send.mockResolvedValue(undefined)
    // The phone remembers sending; the server (adjudicator A has not submitted as far as it knows) is asking for marks
    await saveSent({ adjudicatorId: 'adj-a', roundId: ROUND, submissions: [{ dance: 'cha_cha_cha', competitorIds: ['c1', 'c2'] }], savedAt: new Date().toISOString() })
    renderApp('/adjudicator/mark', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send).toHaveBeenCalledWith('adj-a', ROUND, [{ dance: 'cha_cha_cha', competitorIds: ['c1', 'c2'] }])
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
  })

  it('are not offered again, over and over, once the server refuses them for good', async () => {
    send.mockRejectedValue(new ApiError(409, 'This round is not open for marking.'))
    await saveSent({ adjudicatorId: 'adj-a', roundId: ROUND, submissions: [{ dance: 'cha_cha_cha', competitorIds: ['c1'] }], savedAt: new Date().toISOString() })
    renderApp('/adjudicator/mark', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await waitFor(async () => expect(await loadSent('adj-a', ROUND)).toBeNull())
    await new Promise((r) => setTimeout(r, 400))
    expect(send).toHaveBeenCalledTimes(1)
    expect(useOutbox.getState().pending).toBeNull()
  })

  it('are not used for a round the phone never sent marks for', async () => {
    send.mockResolvedValue(undefined)
    renderApp('/adjudicator/mark', Role.Adjudicator, adjudicator)
    await new Promise((r) => setTimeout(r, 400))
    expect(send).not.toHaveBeenCalled()
  })
})

describe('recovering marks the server lost', () => {
  const kept = (savedAt: string) => ({ adjudicatorId: 'adj-a', roundId: ROUND, submissions: [{ dance: 'cha_cha_cha' as const, competitorIds: ['c1'] }], savedAt })

  it('does not offer marks again just after sending them, even if the server is slow to say submitted', async () => {
    const savedAt = new Date().toISOString()
    await saveSent(kept(savedAt))
    const { rememberSent } = await import('../../lib/recoverSent.ts')
    rememberSent({ adjudicatorId: 'adj-a', roundId: ROUND, savedAt })
    expect(await lostMarksToResend('adj-a', ROUND)).toBeNull()

    // Well after the cooldown, as in a takeover that took minutes, they are offered
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1000)
    try {
      expect(await lostMarksToResend('adj-a', ROUND)).toMatchObject({ roundId: ROUND })
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers marks saved in an earlier page session straight away', async () => {
    await saveSent(kept(new Date().toISOString()))
    expect(await lostMarksToResend('adj-a', ROUND)).toMatchObject({ adjudicatorId: 'adj-a', roundId: ROUND })
  })
})

describe('when the browser reports the Wi-Fi gone', () => {
  it('still tries to send, fails, and says there is no connection, instead of waiting for ever', async () => {
    send.mockRejectedValue(new ApiError(0, 'Cannot reach the venue server. Check the Wi-Fi.'))
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))

    // The phone's Wi-Fi switches off: the browser tells the page
    act(() => void window.dispatchEvent(new Event('offline')))
    expect(await screen.findByText(/saved on this phone/)).toBeInTheDocument()
    expect(useConnection.getState().online).toBe(false)
    expect(useOutbox.getState().pending).not.toBeNull()
  })

  it('tries again by itself while the screen still says offline, and sends once the server answers', async () => {
    send.mockRejectedValueOnce(new ApiError(0, 'Cannot reach the venue server. Check the Wi-Fi.')).mockResolvedValue(undefined)
    await holdMarks()
    renderApp('/adjudicator/submitted', Role.Adjudicator, adjudicator)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    // What the failed request told the app
    act(() => useConnection.setState({ online: false }))
    // No signal that the Wi-Fi is back arrives; the timed retry alone gets the marks through
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2), { timeout: 8000 })
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
  })

  it('sends straight away when the browser says the Wi-Fi is back', async () => {
    send.mockResolvedValue(undefined)
    renderApp('/adjudicator/waiting', Role.Adjudicator, adjudicator)
    act(() => void window.dispatchEvent(new Event('offline')))
    await holdMarks()
    await new Promise((r) => setTimeout(r, 200))
    expect(send).not.toHaveBeenCalled()
    act(() => void window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useOutbox.getState().pending).toBeNull())
  })
})
