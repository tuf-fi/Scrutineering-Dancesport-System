import type { Dance, MarkSubmission } from '@bis/shared'

// What the phone keeps in its own storage (IndexedDB), so a refresh, a crashed browser or a flat battery
// cannot lose an adjudicator's marks.

// Marks that have been confirmed but not yet acknowledged by the server
export interface PendingSubmission {
  adjudicatorId: string
  roundId: string
  submissions: MarkSubmission[]
  savedAt: string
}

// Answers being made on the mark screen, kept while the adjudicator works
export interface Draft {
  adjudicatorId: string
  roundId: string
  answers: Partial<Record<Dance, string[]>>
  savedAt: string
}

type Store = 'outbox' | 'drafts' | 'sent'

const DB_NAME = 'bis-phone'
const keyOf = (v: { adjudicatorId: string; roundId: string }) => `${v.adjudicatorId}:${v.roundId}`

// Used when the browser has no IndexedDB (private windows in some browsers): marks then survive only until a refresh
const fallback: Record<Store, Map<string, unknown>> = { outbox: new Map(), drafts: new Map(), sent: new Map() }

let opened: Promise<IDBDatabase | null> | undefined

function open(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const request = indexedDB.open(DB_NAME, 2)
      request.onupgradeneeded = () => {
        // Also runs for a phone that already has version 1: only the missing stores are made
        for (const store of ['outbox', 'drafts', 'sent'] as const) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opened
}

function run<T>(db: IDBDatabase, store: Store, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = work(tx.objectStore(store))
    // A write is only safe once its transaction has completed
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function put<T extends { adjudicatorId: string; roundId: string }>(store: Store, value: T): Promise<void> {
  const key = keyOf(value)
  fallback[store].set(key, value)
  const db = await open()
  if (db) await run(db, store, 'readwrite', (s) => s.put({ ...value, key }))
}

async function remove(store: Store, value: { adjudicatorId: string; roundId: string }): Promise<void> {
  const key = keyOf(value)
  fallback[store].delete(key)
  const db = await open()
  if (db) await run(db, store, 'readwrite', (s) => s.delete(key))
}

async function all<T>(store: Store): Promise<T[]> {
  const db = await open()
  if (!db) return [...fallback[store].values()] as T[]
  return (await run(db, store, 'readonly', (s) => s.getAll())) as T[]
}

export const savePending = (pending: PendingSubmission) => put('outbox', pending)
export const removePending = (pending: Pick<PendingSubmission, 'adjudicatorId' | 'roundId'>) => remove('outbox', pending)

// The newest marks still waiting to be sent, for this phone
export async function loadPending(): Promise<PendingSubmission | null> {
  const list = await all<PendingSubmission>('outbox')
  return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null
}

// A copy of marks the server has acknowledged. If the server later turns out not to have them (it was restored from
// an older backup after Laptop 2 failed), the phone sends them again.
export const saveSent = (pending: PendingSubmission) => put('sent', pending)

export const removeSent = (pending: Pick<PendingSubmission, 'adjudicatorId' | 'roundId'>) => remove('sent', pending)

export async function loadSent(adjudicatorId: string, roundId: string): Promise<PendingSubmission | null> {
  const list = await all<PendingSubmission>('sent')
  return list.find((p) => p.adjudicatorId === adjudicatorId && p.roundId === roundId) ?? null
}

// Copies older than this are forgotten, so the phone does not collect them for ever
export async function pruneSent(maxAgeMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString()
  for (const old of (await all<PendingSubmission>('sent')).filter((p) => p.savedAt < cutoff)) await remove('sent', old)
}

export const saveDraft = (draft: Draft) => put('drafts', draft)
export const removeDraft = (draft: Pick<Draft, 'adjudicatorId' | 'roundId'>) => remove('drafts', draft)

export async function loadDraft(adjudicatorId: string, roundId: string): Promise<Draft | null> {
  const list = await all<Draft>('drafts')
  return list.find((d) => d.adjudicatorId === adjudicatorId && d.roundId === roundId) ?? null
}

// For tests: forget the open connection so a new "browser session" reads from storage again
export function closePhoneDb() {
  void opened?.then((db) => db?.close())
  opened = undefined
}
