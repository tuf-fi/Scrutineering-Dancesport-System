import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Config } from './config.ts'
import type { Db } from './db/client.ts'
import * as t from './db/schema.ts'

// Facebook Messenger messages to clubs, from the organizer's Facebook Page. A club links its account once by opening a
// link to the Page; the Page then knows who it is and can message it. Nothing here may stop a payment from being
// decided: a message that cannot be sent is logged and the club still sees the status in BIS.

const GRAPH = 'https://graph.facebook.com/v21.0'

export const messengerEnabled = (config: Config): boolean => config.mode === 'cloud' && Boolean(config.messenger.pageToken && config.messenger.pageUsername)

// The link a club opens to connect. The code in it proves which club opened it; it is signed so it cannot be guessed.
function sign(config: Config, clubId: string): string {
  return createHmac('sha256', config.cookieSecret).update(`messenger:${clubId}`).digest('hex').slice(0, 24)
}

export const linkCode = (config: Config, clubId: string): string => `club.${clubId}.${sign(config, clubId)}`

export function clubFromLinkCode(config: Config, code: string): string | null {
  const [kind, clubId, signature] = code.split('.')
  if (kind !== 'club' || !clubId || !signature) return null
  const expected = sign(config, clubId)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return clubId
}

export const linkUrl = (config: Config, clubId: string): string => `https://m.me/${config.messenger.pageUsername}?ref=${encodeURIComponent(linkCode(config, clubId))}`

// Facebook signs every webhook call with the app secret
export function validSignature(config: Config, rawBody: string, header: string | undefined): boolean {
  const secret = config.messenger.appSecret
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const given = header.slice('sha256='.length)
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

export async function sendMessage(config: Config, recipientId: string, text: string): Promise<boolean> {
  if (!messengerEnabled(config)) return false
  try {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(config.messenger.pageToken!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        // A reminder about something the club registered for, which Facebook allows outside the 24-hour reply window
        messaging_type: 'MESSAGE_TAG',
        tag: 'CONFIRMED_EVENT_UPDATE',
        message: { text },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.warn(`Messenger did not accept a message (${res.status}): ${(await res.text()).slice(0, 200)}`)
    return res.ok
  } catch (error) {
    console.warn('Messenger could not be reached:', error instanceof Error ? error.message : error)
    return false
  }
}

// Tells a club about a decision on its payment, if it has linked Messenger
export async function notifyClub(config: Config, db: Db, clubId: string, text: string): Promise<boolean> {
  if (!messengerEnabled(config)) return false
  const club = db.select({ messengerId: t.clubs.messengerId }).from(t.clubs).where(eq(t.clubs.id, clubId)).get()
  return club?.messengerId ? sendMessage(config, club.messengerId, text) : false
}
