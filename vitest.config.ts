import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      'src/*': resolve(__dirname, 'src'),
      // Mock bun:bundle feature flags
      'bun:bundle': resolve(__dirname, 'vitest.bun-bundle-mock.ts'),
    },
  },
})
