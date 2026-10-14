import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

// A page reload keeps the cookie but loses the store: ask the server who this is before drawing any screen
export async function restoreSession() {
  try {
    const user = await api.getSession()
    if (user) useAuth.getState().signIn(user)
  } catch {
    // The server cannot be reached: start signed out; the sign-in screen explains if it stays unreachable
  }
}
