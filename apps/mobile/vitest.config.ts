import { defineConfig } from 'vitest/config'

// Mobile's runtime is React Native, which vitest can't execute directly —
// full native-component tests require the jest-expo preset + a device or
// simulator. What vitest can do cheaply is exercise pure TypeScript modules
// (our lib/ helpers, shared-package wiring, etc.) in Node.
//
// So this config:
//   - Runs in Node (no jsdom needed — no DOM access in these modules).
//   - Only picks up tests under __tests__/ that are intentionally written
//     to be platform-agnostic.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
  },
})
