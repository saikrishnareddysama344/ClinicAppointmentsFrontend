// Automated tests: npm run test:e2e
// Starts its own backend (test schemas only) and frontend on separate ports,
// so it can run while your normal dev servers are running.
import { defineConfig, devices } from '@playwright/test'
import { API_PORT, API_URL, BACKEND_DIR, BACKEND_TEST_ENV, FRONTEND_DIR, PYTHON, UI_PORT, UI_URL } from './tests/e2e/env.js'

const backendCommand = process.env.E2E_BACKEND_COMMAND ||
  `${PYTHON} -m scripts.test_env reset && ${PYTHON} run.py`

const servers = [
  {
    name: 'API',
    command: backendCommand,
    cwd: BACKEND_DIR,
    url: `${API_URL}/v1/health`,
    env: { ...process.env, ...BACKEND_TEST_ENV },
    reuseExistingServer: false,
    timeout: 180_000, // resetting schemas + migrations over the network can take a while
    stdout: 'pipe',
    stderr: 'pipe'
  }
]

if (!process.env.E2E_SKIP_UI_SERVER) {
  servers.push({
    name: 'UI',
    command: `npm run dev -- --port ${UI_PORT} --strictPort`,
    cwd: FRONTEND_DIR,
    url: UI_URL,
    env: { ...process.env, VITE_API_PROXY_TARGET: API_URL },
    reuseExistingServer: false,
    timeout: 120_000
  })
}

export default defineConfig({
  testDir: './tests/e2e',
  // One worker: tests share one backend and database.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 }, // the database is far away; saves can take several seconds
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalTeardown: './tests/e2e/global-teardown.js',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'api', testMatch: /api\/.*\.spec\.js/, use: { baseURL: API_URL } },
    { name: 'ui', testMatch: /ui\/.*\.spec\.js/, use: { ...devices['Desktop Chrome'], baseURL: UI_URL } }
  ],
  webServer: servers
})
