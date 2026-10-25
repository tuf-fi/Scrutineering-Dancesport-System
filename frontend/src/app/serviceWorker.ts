// An earlier version registered a service worker that kept an offline copy of the app. It is gone now, but a phone that
// installed it would keep serving that old copy, so remove it and its caches.
// TODO: delete this once no phone can still hold the old service worker.
export async function removeOldServiceWorker() {
  try {
    if ('serviceWorker' in navigator) {
      for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()
    }
    if ('caches' in window) {
      for (const key of await caches.keys()) await caches.delete(key)
    }
  } catch (error) {
    console.warn('The old offline copy of the app could not be removed:', error)
  }
}
