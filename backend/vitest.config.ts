import { defineConfig } from 'vitest/config'

// Some tests start whole servers; give them room when the machine is busy (for example while the frontend tests run too)
export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 30_000 } })
