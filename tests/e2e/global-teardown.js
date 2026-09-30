// After all tests: remove the test schemas. Set E2E_KEEP_DATA=1 to keep them for debugging.
import { execSync } from 'node:child_process'
import { BACKEND_DIR, BACKEND_TEST_ENV, PYTHON } from './env.js'

export default function globalTeardown() {
  if (process.env.E2E_KEEP_DATA) {
    console.log('E2E_KEEP_DATA set: test schemas kept.')
    return
  }
  const command = process.env.E2E_DROP_COMMAND || `${PYTHON} -m scripts.test_env drop`
  try {
    execSync(command, { cwd: BACKEND_DIR, env: { ...process.env, ...BACKEND_TEST_ENV }, stdio: 'inherit' })
  } catch (e) {
    console.warn(`Could not drop test schemas: ${e.message}`)
  }
}
