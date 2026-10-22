import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests run the real storefront and admin in a real browser, but against a FAKE
 * Supabase (see e2e/support/mockSupabase.ts). The environment below points the app at an
 * address that does not exist, and every request to it is answered by the tests. So these
 * tests never read or write your real database and never send email.
 *
 * Run:  npm run e2e        (uses the Chrome already installed on this computer)
 */
const PORT = 5199

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      VITE_APP_URL: `http://localhost:${PORT}`,
    },
  },
})
