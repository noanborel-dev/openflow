import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Plain Node — the units under test (SerialQueue) are pure and
    // pull in no Electron / native deps.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
