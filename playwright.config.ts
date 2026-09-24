import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const DB = './e2e.db'

/**
 * The end-to-end run gets its own database and its own port, so it can never
 * touch whatever is in the dev server or the demo trips.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `rm -rf e2e.db && DATABASE_URL=${DB} npx drizzle-kit push --force && DATABASE_URL=${DB} npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: DB, TRIPTOGETHER_SECRET: 'e2e-secret' },
  },
})
