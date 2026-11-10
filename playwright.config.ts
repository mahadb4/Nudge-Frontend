import { defineConfig } from '@playwright/test';

/* The tests run against the production build served by `vite preview`, so the real
   Content-Security-Policy and security headers are in force. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 }, acceptDownloads: true },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000, env: { VITE_USE_MOCK_API: 'true' } },
});
