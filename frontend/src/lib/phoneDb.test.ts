import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOutbox } from '../stores/outbox.ts'
import { closePhoneDb, loadDraft, loadPending, loadSent, pruneSent, removeDraft, removePending, removeSent, saveDraft, savePending, saveSent } from './phoneDb.ts'

const marks = (competitorIds: string[]) => [{ dance: 'samba' as const, competitorIds }]
const pending = (roundId: string, savedAt: string) => ({ adjudicatorId: 'adj-a', roundId, submissions: marks(['c1', 'c2']), savedAt })

// Closing the browser forgets everything in memory but keeps what is in storage
function restartBrowser() {
  closePhoneDb()
  useOutbox.setState({ pending: null })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  closePhoneDb()
  useOutbox.setState({ pending: null })
})
afterEach(() => closePhoneDb())

describe('marks waiting to be sent', () => {
  it('survive the browser being closed', async () => {
    await savePending(pending('r1', '2026-10-10T01:00:00Z'))
    restartBrowser()
    expect(await loadPending()).toMatchObject({ roundId: 'r1', submissions: marks(['c1', 'c2']) })
  })

  it('come back newest first, and are forgotten one at a time', async () => {
    await savePending(pending('r1', '2026-10-10T01:00:00Z'))
    await savePending(pending('r2', '2026-10-10T02:00:00Z'))
    expect((await loadPending())!.roundId).toBe('r2')
    await removePending({ adjudicatorId: 'adj-a', roundId: 'r2' })
    expect((await loadPending())!.roundId).toBe('r1')
    await removePending({ adjudicatorId: 'adj-a', roundId: 'r1' })
    expect(await loadPending()).toBeNull()
  })

  it('are replaced, not added, when the same round is saved again', async () => {
    await savePending({ ...pending('r1', '2026-10-10T01:00:00Z'), submissions: marks(['c1']) })
    await savePending({ ...pending('r1', '2026-10-10T01:05:00Z'), submissions: marks(['c9']) })
    expect((await loadPending())!.submissions).toEqual(marks(['c9']))
  })
})

describe('the outbox store', () => {
  it('stores the marks before reporting them saved, and restores them after a restart', async () => {
    await useOutbox.getState().save({ adjudicatorId: 'adj-a', roundId: 'r1', submissions: marks(['c1']) })
    expect(useOutbox.getState().pending).toMatchObject({ roundId: 'r1' })
    restartBrowser()
    expect(useOutbox.getState().pending).toBeNull()
    await useOutbox.getState().restore()
    expect(useOutbox.getState().pending).toMatchObject({ adjudicatorId: 'adj-a', roundId: 'r1' })
  })

  it('forgets marks once cleared, so a restart does not send them again', async () => {
    await useOutbox.getState().save({ adjudicatorId: 'adj-a', roundId: 'r1', submissions: marks(['c1']) })
    await useOutbox.getState().clear()
    expect(useOutbox.getState().pending).toBeNull()
    restartBrowser()
    await useOutbox.getState().restore()
    expect(useOutbox.getState().pending).toBeNull()
  })

  it('picks up older marks after the newest is cleared', async () => {
    await savePending(pending('r1', '2026-10-10T01:00:00Z'))
    await useOutbox.getState().save({ adjudicatorId: 'adj-a', roundId: 'r2', submissions: marks(['c1']) })
    await useOutbox.getState().clear()
    expect(useOutbox.getState().pending).toMatchObject({ roundId: 'r1' })
  })

  it('does nothing when there is nothing to clear', async () => {
    await expect(useOutbox.getState().clear()).resolves.toBeUndefined()
  })
})

describe('answers being made', () => {
  it('are kept per adjudicator and round, and removed when finished', async () => {
    const answers = { samba: ['c1', 'c3'] }
    await saveDraft({ adjudicatorId: 'adj-a', roundId: 'r1', answers, savedAt: 'now' })
    await saveDraft({ adjudicatorId: 'adj-b', roundId: 'r1', answers: { samba: ['c9'] }, savedAt: 'now' })
    restartBrowser()
    expect((await loadDraft('adj-a', 'r1'))!.answers).toEqual(answers)
    expect((await loadDraft('adj-b', 'r1'))!.answers).toEqual({ samba: ['c9'] })
    expect(await loadDraft('adj-a', 'r2')).toBeNull()
    await removeDraft({ adjudicatorId: 'adj-a', roundId: 'r1' })
    expect(await loadDraft('adj-a', 'r1')).toBeNull()
  })
})

describe('copies of marks the server acknowledged', () => {
  it('are kept after the browser is closed, per adjudicator and round', async () => {
    await saveSent(pending('r1', new Date().toISOString()))
    restartBrowser()
    expect((await loadSent('adj-a', 'r1'))!.submissions).toEqual(marks(['c1', 'c2']))
    expect(await loadSent('adj-a', 'r2')).toBeNull()
    expect(await loadSent('adj-b', 'r1')).toBeNull()
    await removeSent({ adjudicatorId: 'adj-a', roundId: 'r1' })
    expect(await loadSent('adj-a', 'r1')).toBeNull()
  })

  it('are forgotten after a day, so the phone does not collect them', async () => {
    const hours = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
    await saveSent(pending('old', hours(30)))
    await saveSent(pending('recent', hours(2)))
    await pruneSent(24 * 3_600_000)
    expect(await loadSent('adj-a', 'old')).toBeNull()
    expect(await loadSent('adj-a', 'recent')).not.toBeNull()
  })

  it('are not mistaken for marks still waiting to be sent', async () => {
    await saveSent(pending('r1', new Date().toISOString()))
    expect(await loadPending()).toBeNull()
  })
})

describe('a phone that had the first version of the storage', () => {
  it('gains the new store without losing what it was holding', async () => {
    const factory = new IDBFactory()
    globalThis.indexedDB = factory
    closePhoneDb()
    // Version 1, as an earlier release created it: no "sent" store
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('bis-phone', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('outbox', { keyPath: 'key' })
        request.result.createObjectStore('drafts', { keyPath: 'key' })
      }
      request.onsuccess = () => {
        const tx = request.result.transaction('outbox', 'readwrite')
        tx.objectStore('outbox').put({ ...pending('r1', '2026-10-10T01:00:00Z'), key: 'adj-a:r1' })
        tx.oncomplete = () => {
          request.result.close()
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
    expect((await loadPending())!.roundId).toBe('r1')
    await saveSent(pending('r2', new Date().toISOString()))
    expect((await loadSent('adj-a', 'r2'))!.roundId).toBe('r2')
  })
})

describe('a browser with no storage', () => {
  it('still holds the marks until the page is refreshed', async () => {
    // @ts-expect-error simulating a browser without IndexedDB
    globalThis.indexedDB = undefined
    closePhoneDb()
    await savePending(pending('r1', '2026-10-10T01:00:00Z'))
    expect((await loadPending())!.roundId).toBe('r1')
    await removePending({ adjudicatorId: 'adj-a', roundId: 'r1' })
    expect(await loadPending()).toBeNull()
  })
})
