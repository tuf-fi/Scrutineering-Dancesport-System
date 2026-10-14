import { Role, type SessionUser } from '@bis/shared'
import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { Presence, type Hub } from './hub.ts'

export const SESSION_COOKIE = 'bis_session'

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc]

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

// Rooms: every connection is in "public"; a signed-in one is also in "signedin", staff roles in "staff", and "me:<id>"
export function createSocketHub(server: HttpServer, verify: (token: string) => SessionUser | null): Hub {
  const io = new Server(server, { serveClient: false })
  const presence = new Presence()

  io.on('connection', (socket) => {
    const token = cookieValue(socket.handshake.headers.cookie, SESSION_COOKIE)
    const user = token ? verify(token) : null
    socket.join('public')
    if (user) {
      socket.join('signedin')
      if (STAFF_ROLES.includes(user.role)) socket.join('staff')
      socket.join(`me:${user.id}`)
      if (user.role === 'adjudicator') presence.seen(user.id)
      socket.on('heartbeat', () => {
        if (user.role === 'adjudicator') presence.seen(user.id)
      })
    }
  })

  return {
    changed: (scope) => void io.to('signedin').emit('changed', { scope: scope ?? null }),
    submissions: (roundId, snapshot) => void io.to('staff').emit('submissions', { roundId, snapshot }),
    floor: (roundId) => void io.to('signedin').emit('floor', { roundId }),
    published: (info) => void io.to('public').emit('published', info),
    rankings: () => void io.to('public').emit('rankings', {}),
    seen: (id) => presence.seen(id),
    lastSeen: (id) => presence.lastSeen(id),
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => resolve())
      }),
  }
}
