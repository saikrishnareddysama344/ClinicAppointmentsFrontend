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

// Double clicks: the button (or menu item) whose click started a change (POST / PUT / DELETE) stays
// blocked until the server has answered, so the same action cannot be sent twice. Works for every
// button in the app without changes to the pages.
const CLICKABLE = 'button, [role="button"], [role="menuitem"], .p-menu-item-link'
let lastClick = { el: null, at: 0 }
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const el = event.target?.closest?.(CLICKABLE)
    if (!el) return
    if (el.dataset.busy) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    lastClick = { el, at: Date.now() }
  }, true)
}

function holdClicked() {
  const { el, at } = lastClick
  if (!el || Date.now() - at > 1500) return () => {}
  el.dataset.busy = '1'
  el.setAttribute('aria-busy', 'true')
  return () => {
    delete el.dataset.busy
    el.removeAttribute('aria-busy')
  }
}

export async function request(method, path, body) {
  const release = method === 'GET' ? () => {} : holdClicked()
  try {
    return await send(method, path, body)
  } finally {
    release()
  }
}

async function send(method, path, body) {
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

// A file the API makes (e.g. a QR code image) as a Blob, sent with the login token.
export async function fetchBlob(path) {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, { headers: authHeader() })
  if (!response.ok) {
    if (response.status === 401) unauthorized()
    throw new ApiError(`Request failed (${response.status})`, response.status, {})
  }
  return response.blob()
}
