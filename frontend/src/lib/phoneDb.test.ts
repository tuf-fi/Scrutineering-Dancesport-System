import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOutbox } from '../stores/outbox.ts'
import { closePhoneDb, loadDraft, loadPending, removeDraft, removePending, saveDraft, savePending } from './phoneDb.ts'

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
