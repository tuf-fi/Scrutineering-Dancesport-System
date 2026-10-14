import type { ApiFunction } from '@bis/shared'

// An error the server explained in words (status 400 to 499), or one that never reached it (status 0)
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// True when the request never reached the venue server: the phone is offline or the server is down
export const isNetworkError = (error: unknown): boolean => error instanceof ApiError && error.status === 0

// Told after every request whether the server could be reached, so the "Online" badge is honest
type Listener = (reachable: boolean) => void
let reachability: Listener = () => {}
export const onReachability = (listener: Listener) => void (reachability = listener)

// Told when the server says the session has ended (signed out elsewhere, account removed, 12 hours passed)
let ended: () => void = () => {}
export const onSessionEnded = (listener: () => void) => void (ended = listener)

const SERVER_DOWN = 'Cannot reach the venue server. Check the Wi-Fi.'

async function send<T>(method: 'GET' | 'POST', url: string, body?: unknown, signingIn = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    reachability(false)
    throw new ApiError(0, SERVER_DOWN)
  }
  reachability(true)
  let payload: { data?: T; error?: string } = {}
  try {
    payload = (await res.json()) as typeof payload
  } catch {
    // A reply that is not JSON means something other than BIS answered
    throw new ApiError(res.status, res.ok ? 'The server sent something unexpected.' : `The server answered ${res.status}.`)
  }
  if (!res.ok) {
    if (res.status === 401 && !signingIn) ended()
    throw new ApiError(res.status, payload.error ?? `The server answered ${res.status}.`)
  }
  return payload.data as T
}

// Calls one server function by name
export const call = <T>(name: ApiFunction, ...args: unknown[]): Promise<T> => send<T>('POST', `/api/call/${name}`, { args })

export const auth = <T>(path: string, body: unknown): Promise<T> => send<T>('POST', `/api/auth/${path}`, body, true)

export const getSessionFromServer = <T>(): Promise<T> => send<T>('GET', '/api/auth/me')
