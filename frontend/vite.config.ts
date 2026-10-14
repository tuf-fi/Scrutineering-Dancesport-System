import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'
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
    plugins: [...(useMocks ? [sampleApi()] : []), react(), tailwindcss()],
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
