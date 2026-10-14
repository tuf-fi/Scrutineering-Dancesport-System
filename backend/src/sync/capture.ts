import type { Sqlite } from '../db/client.ts'

const KEY = 'sync_capture'

// Turns change capture on or off. The triggers read this setting, so it is part of the database and works for every
// connection. Only a venue with a cloud address turns it on.
export function setCapture(sqlite: Sqlite, on: boolean) {
  if (on) {
    sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(KEY, 'on')
  } else {
    sqlite.prepare('DELETE FROM settings WHERE key = ?').run(KEY)
  }
}

export const captureIsOn = (sqlite: Sqlite): boolean =>
  (sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined)?.value === 'on'

// Runs a change that must not be sent back to where it came from (applying a download), then restores capture
export function withoutCapture<T>(sqlite: Sqlite, work: () => T): T {
  const was = captureIsOn(sqlite)
  setCapture(sqlite, false)
  try {
    return work()
  } finally {
    setCapture(sqlite, was)
  }
}
