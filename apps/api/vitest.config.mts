import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

// `.mts` is loaded as ESM, so __dirname isn't defined — derive it from import.meta.
// (`.mts` keeps Vite from loading via its deprecated CJS Node API.)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@imposter/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
