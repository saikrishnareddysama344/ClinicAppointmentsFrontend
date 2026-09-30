// Thin fetch wrapper. Every backend response has {status, message, ...};
// status === false (or a non-2xx code) becomes an ApiError.
// The login token (set by services/auth.js) goes with every request.
import { appConfig } from '@/config/env'

export class ApiError extends Error {
  constructor(message, httpStatus, data) {
    super(message)
    this.httpStatus = httpStatus
    this.data = data || {}
  }
}

let token = null
let unauthorized = () => {}
export const setToken = (value) => (token = value || null)
export const authHeader = () => (token ? { Authorization: `Bearer ${token}` } : {})
export const onUnauthorized = (handler) => (unauthorized = handler)

export async function request(method, path, body) {
  let response
  try {
    response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeader() },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError('Cannot reach the API. Start it with backend\\manage.bat (option 1).', 0, {})
  }

  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (response.status === 401 && !path.startsWith('/v1/auth/login')) unauthorized(data.message)
  if (!response.ok || data.status === false) {
    const fallback = response.status === 502 || response.status === 504
      ? 'The API is not running. Start it with backend\\manage.bat (option 1).'
      : `Request failed (${response.status})`
    throw new ApiError(data.message || fallback, response.status, data)
  }
  return data
}

// Downloads that need the login token (a plain link cannot send it).
export async function download(path, fileName) {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, { headers: authHeader() })
  if (!response.ok) {
    let message = `Download failed (${response.status})`
    try {
      message = (await response.json()).message || message
    } catch { /* not JSON */ }
    if (response.status === 401) unauthorized(message)
    throw new ApiError(message, response.status, {})
  }
  const url = URL.createObjectURL(await response.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
