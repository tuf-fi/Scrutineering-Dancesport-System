import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Role } from '@bis/shared'
import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/http.ts'
import { closePhoneDb, loadPending } from '../../lib/phoneDb.ts'
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
