/** Run browser journeys against a live local production preview. */
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';
const env = loadEnv('test', '.', '');
const port = Number(process.env.VITE_PORT || env.VITE_PORT || 5173);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: '../e2e',
  workers: 1,
  fullyParallel: false,
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
