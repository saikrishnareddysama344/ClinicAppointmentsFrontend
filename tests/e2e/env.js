// Settings for the automated tests. The backend runs against the same database
// as development, but in separate schemas (e2e_config, e2e_t_<id>) that are
// wiped before and after every run, so your real data is never touched.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const FRONTEND_DIR = path.resolve(here, '../..')
export const BACKEND_DIR = path.resolve(FRONTEND_DIR, '../backend')

export const API_PORT = Number(process.env.E2E_API_PORT || 5055)
export const UI_PORT = Number(process.env.E2E_UI_PORT || 5174)
export const API_URL = `http://127.0.0.1:${API_PORT}`
export const UI_URL = `http://localhost:${UI_PORT}`

// Python inside backend\.venv (override with E2E_PYTHON if yours is elsewhere).
export const PYTHON = process.env.E2E_PYTHON ||
  (process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')

export const BACKEND_TEST_ENV = {
  APP_ENV: 'test',
  CONFIG_SCHEMA: 'e2e_config',
  TENANT_SCHEMA_PREFIX: 'e2e_t_',
  API_HOST: '127.0.0.1',
  API_PORT: String(API_PORT),
  API_DEBUG: 'false',
  LOG_DIR: 'logs/e2e',
  CORS_ORIGINS: UI_URL,
  // Tests submit many times in a row; the limiter itself is covered by backend tests.
  PUBLIC_SUBMIT_LIMIT_PER_MINUTE: '1000',
  PUBLIC_VIEW_LIMIT_PER_MINUTE: '1000'
}
