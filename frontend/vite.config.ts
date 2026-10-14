import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const BACKEND = 'http://localhost:4000'

const slashes = (path: string) => path.replace(/\\/g, '/')

// Points every import of src/api/index.ts at the sample data, for tests and for working without the server
function sampleApi(): Plugin {
  const real = slashes(resolve(import.meta.dirname, 'src/api/index.ts'))
  const sample = resolve(import.meta.dirname, 'src/mocks/api.ts')
  return {
    name: 'bis-sample-api',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.endsWith('api/index.ts')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && slashes(resolved.id) === real ? sample : null
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMocks = mode === 'test' || mode === 'mock' || env.VITE_API === 'mock'
  return {
    plugins: [
      ...(useMocks ? [sampleApi()] : []),
      react(),
      tailwindcss(),
      // Lets the app open with no connection once a phone has loaded it. Only browsers that allow service workers
      // (HTTPS, or localhost) use it; elsewhere the app works as before, and marks are kept by the phone's own storage.
      VitePWA({
        disable: useMocks,
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'BIS: Bicol Information Scrutineering System',
          short_name: 'BIS',
          description: 'Scoring and results for dancesport competitions',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#171412',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
          // Screens open offline; data never comes from the cache, so the server's answers are always current
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3_000_000,
        },
      }),
    ],
    define: { __USE_MOCKS__: JSON.stringify(useMocks) },
    server: {
      // The frontend runs on its own port while developing; the server does the real work
      proxy: {
        '/api': BACKEND,
        '/socket.io': { target: BACKEND, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      css: false,
      testTimeout: 15_000,
    },
  }
})
