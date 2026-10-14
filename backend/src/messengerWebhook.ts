import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { record } from './core/audit.ts'
import type { Config } from './config.ts'
import type { Db } from './db/client.ts'
import * as t from './db/schema.ts'
import { clubFromLinkCode, sendMessage, validSignature } from './messenger.ts'

interface Event {
  sender?: { id?: string }
  referral?: { ref?: string }
  postback?: { referral?: { ref?: string } }
}

// What Facebook calls when someone opens the Page's link or writes to it. Opening the club's link carries its code.
export function registerMessengerWebhook(app: FastifyInstance, { config, db }: { config: Config; db: Db }) {
  app.register(async (scope) => {
    // The signature covers the exact bytes sent, so keep the body as text and read it ourselves
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => done(null, body))

    scope.get('/api/messenger/webhook', async (request, reply) => {
      const q = request.query as Record<string, string | undefined>
      const expected = config.messenger.verifyToken
      if (expected && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === expected) return reply.type('text/plain').send(q['hub.challenge'] ?? '')
      return reply.code(403).send('Forbidden')
    })

    scope.post('/api/messenger/webhook', async (request, reply) => {
      const raw = String(request.body ?? '')
      if (!validSignature(config, raw, request.headers['x-hub-signature-256'] as string | undefined)) return reply.code(403).send('Forbidden')
      let payload: { entry?: Array<{ messaging?: Event[] }> }
      try {
        payload = JSON.parse(raw)
      } catch {
        return reply.code(400).send('Bad request')
      }
      for (const entry of payload.entry ?? []) {
        for (const event of entry.messaging ?? []) {
          const psid = event.sender?.id
          const ref = event.referral?.ref ?? event.postback?.referral?.ref
          const clubId = ref ? clubFromLinkCode(config, ref) : null
          if (!psid || !clubId) continue
          const club = db.select().from(t.clubs).where(eq(t.clubs.id, clubId)).get()
          if (!club) continue
          db.update(t.clubs).set({ messengerId: psid }).where(eq(t.clubs.id, clubId)).run()
          record(db, clubId, 'Club linked Messenger', club.name)
          void sendMessage(config, psid, `${club.name} is connected. You will get a message here when a payment is approved or rejected.`)
        }
      }
      return reply.send('EVENT_RECEIVED')
    })
  })
}
