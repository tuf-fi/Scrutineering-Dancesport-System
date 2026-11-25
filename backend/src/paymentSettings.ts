import { DEFAULT_MEMBERSHIP_FEES, type PaymentMethod, type PaymentSettings } from '@bis/shared'
import type { Sqlite } from './db/client.ts'

// The membership fees and where teams send payment, set by the organizer. They live in the settings table, so a backup
// carries them.
const PAYMENT_SETTINGS_KEY = 'payment_settings'

const NO_PAYMENT_SETTINGS: PaymentSettings = { memberships: DEFAULT_MEMBERSHIP_FEES, methods: [] }

// Settings saved before competitions had their own fees kept the membership prices in a fee schedule
interface Saved extends Partial<PaymentSettings> {
  schedule?: { athleteMembership: number; coachMembership: number; coachesSummit: number }
}

export function readPaymentSettings(sqlite: Sqlite): PaymentSettings {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(PAYMENT_SETTINGS_KEY) as { value: string } | undefined
  if (!row) return NO_PAYMENT_SETTINGS
  try {
    const saved = JSON.parse(row.value) as Saved
    const old = saved.schedule
    return {
      memberships: saved.memberships ?? (old ? { athlete: old.athleteMembership, coach: old.coachMembership, summit: old.coachesSummit } : DEFAULT_MEMBERSHIP_FEES),
      methods: Array.isArray(saved.methods) ? (saved.methods as PaymentMethod[]) : [],
    }
  } catch {
    return NO_PAYMENT_SETTINGS
  }
}

export function writePaymentSettings(sqlite: Sqlite, settings: PaymentSettings): void {
  sqlite
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .run(PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
}
