// The logged-in user. The login token is kept in localStorage (key TOKEN_KEY) and sent with every
// API call by http.js. `user` holds /v1/auth/me: name, platform-admin flag and, per clinic, the
// permissions the backend worked out from the user's roles.
import { computed, ref } from 'vue'
import { authApi } from '@/services/api'
import { onUnauthorized, setToken } from '@/services/http'

export const TOKEN_KEY = 'bw_token'
const NOTICE_KEY = 'bw_logout_notice'   // why the last session ended, shown once on the login page

const read = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch { /* private mode: the session simply lasts until the tab closes */ }
}

export const user = ref(null)
let loading = null
setToken(read(TOKEN_KEY))

export const isPlatformAdmin = computed(() => !!user.value?.is_platform_admin)
export const mustChangePassword = computed(() => !!user.value?.must_change_password)
export const clinics = computed(() => user.value?.clinics || [])

// What the user may do in one clinic (by code), from /v1/auth/me. App admins and the clinic's tenant
// admins can do everything; others get pages -> actions / columns from their roles.
// Pages: "forms", "lists", "timings", "bookings", "form:<id>" (a form's submissions), "list:<id>".
const clinicOf = (tenantCode) => clinics.value.find((c) => c.code === tenantCode)

export function isAdmin(tenantCode) {
  return isPlatformAdmin.value || !!clinicOf(tenantCode)?.is_admin
}

export function can(tenantCode, page, action = 'view') {
  if (isAdmin(tenantCode)) return true
  return !!clinicOf(tenantCode)?.pages?.[page]?.actions.includes(action)
}

// Any page whose key starts with prefix ("form:" = some form's submissions) the user may do action on
// (a list entry without actions only limits that list's values: it opens nothing).
export function hasPageLike(tenantCode, prefix, action = 'view') {
  if (isAdmin(tenantCode)) return true
  return Object.entries(clinicOf(tenantCode)?.pages || {})
    .some(([key, page]) => key.startsWith(prefix) && page.actions.includes(action))
}

// Forms New entry on Bookings may use without their Submissions page (the roles' bookings "entry_forms").
export const entryForms = (tenantCode) => clinicOf(tenantCode)?.pages?.bookings?.entry_forms || []

// Do the user's roles limit which values of a list (e.g. which branches) they may use?
export const isLimited = (tenantCode, listId) => !isAdmin(tenantCode)
  && !!clinicOf(tenantCode)?.limited_lists?.includes(`list:${listId}`)

// Loads the user once (after a page load); null when not logged in.
export function loadUser() {
  if (!read(TOKEN_KEY)) return Promise.resolve(null)
  loading ||= authApi.me()
    .then((r) => (user.value = r.user))
    .catch(() => (user.value = null))
  return loading
}

export async function login(email, password) {
  const r = await authApi.login({ email, password })
  write(TOKEN_KEY, r.token)
  setToken(r.token)
  write(NOTICE_KEY, null)
  user.value = r.user
  loading = Promise.resolve(r.user)
  return r.user
}

export async function refreshUser() {
  loading = null
  return loadUser()
}

// Ends this session. The page reloads so no data of this user stays in memory.
export async function logout(notice) {
  try {
    if (read(TOKEN_KEY) && !notice) await authApi.logout()
  } catch { /* already ended */ }
  write(TOKEN_KEY, null)
  write(NOTICE_KEY, notice || null)
  window.location.assign('/login')
}

// Kept until the next successful login, so a page reload cannot lose it.
export const logoutNotice = () => read(NOTICE_KEY)

// Any API call answered 401 (session ended elsewhere, expired, ...) logs out with the reason.
onUnauthorized((message) => {
  if (read(TOKEN_KEY)) logout(message || 'Please log in again.')
})
