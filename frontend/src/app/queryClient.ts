import { QueryClient, type QueryClientConfig } from '@tanstack/react-query'

// 'always': the library must not pause requests when the browser says it is offline. That flag is unreliable on a
// Wi-Fi network (connected, but no route to the server), and a paused request is never tried, never fails and so never
// tells the phone it is offline. The app decides for itself from what the server answers (see api/http.ts).
export const queryDefaults: QueryClientConfig['defaultOptions'] = {
  queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
  mutations: { networkMode: 'always' },
}

export const queryClient = new QueryClient({ defaultOptions: queryDefaults })
