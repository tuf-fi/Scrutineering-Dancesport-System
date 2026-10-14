import type { PaymentMethod, PaymentSettings } from '@bis/shared'
import type { Sqlite } from './db/client.ts'

// Entry fees and where clubs send payment, set by the organizer. They live in the settings table, so a backup carries
// them, and a download hands them to the venue (which needs the fees for late entries).
export const PAYMENT_SETTINGS_KEY = 'payment_settings'

export const NO_PAYMENT_SETTINGS: PaymentSettings = { fees: null, methods: [] }

export function readPaymentSettings(sqlite: Sqlite): PaymentSettings {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(PAYMENT_SETTINGS_KEY) as { value: string } | undefined
  if (!row) return NO_PAYMENT_SETTINGS
  try {
    const saved = JSON.parse(row.value) as Partial<PaymentSettings>
    return { fees: saved.fees ?? null, methods: Array.isArray(saved.methods) ? (saved.methods as PaymentMethod[]) : [] }
  } catch {
    return NO_PAYMENT_SETTINGS
  }
}

export function writePaymentSettings(sqlite: Sqlite, settings: PaymentSettings): void {
  sqlite
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .run(PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
}
