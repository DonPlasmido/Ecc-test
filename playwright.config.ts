import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
  },
  projects: [{ name: 'android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    env: { BASE_PATH: '/' },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
