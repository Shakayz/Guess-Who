import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// `.mts` is loaded as ESM, so __dirname isn't defined — derive it from import.meta.
// (`.mts` keeps Vite from loading via its deprecated CJS Node API.)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      exclude: [
        'postcss.config.js',
        'tailwind.config.ts',
        'src/main.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@red-handed/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@red-handed/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
})
