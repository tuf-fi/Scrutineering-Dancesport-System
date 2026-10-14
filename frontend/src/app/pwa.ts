import { usingMocks } from '../api/mode.ts'

// Registers the service worker that lets the app open with no connection. Browsers only allow one on HTTPS
// (or localhost), so on plain http://<laptop address> this does nothing and the app works as before: a phone that
// is already on the page keeps working through a Wi-Fi drop, and its marks are held in the phone's own storage.
// A new version waits until the browser is closed and reopened, so a round is never interrupted by an update.
export async function registerServiceWorker() {
  if (usingMocks || !('serviceWorker' in navigator) || !window.isSecureContext) return
  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  } catch (error) {
    console.warn('The offline copy of the app could not be set up:', error)
  }
}
