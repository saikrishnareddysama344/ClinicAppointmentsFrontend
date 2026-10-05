import { createRouter, createWebHistory } from 'vue-router'
import { appConfig } from '@/config/env'
import { can, clinics, hasPageLike, isAdmin, isPlatformAdmin, loadUser, mustChangePassword, user } from '@/services/auth'

export const ROUTES = Object.freeze({
  TENANTS: 'tenants',
  FORMS: 'forms',
  FORM_BUILDER: 'form-builder',
  SUBMISSIONS: 'submissions',
  LISTS: 'lists',
  LIST_BUILDER: 'list-builder',
  LIST_ROWS: 'list-rows',
  TIMINGS: 'timings',
  BOOKINGS: 'bookings',
  SETTINGS: 'settings',
  USERS: 'users',
  ROLES: 'roles',
  LOGIN: 'login',
  PASSWORD: 'password',
  PUBLIC_FORM: 'public-form',
  MESSAGING: 'messaging'
})

// The tabs of a clinic, in order, and who may open each (TenantNav shows the allowed ones, and
// opening a clinic goes to the first allowed tab).
export const CLINIC_TABS = Object.freeze([
  { label: 'Bookings', icon: 'pi pi-ticket', route: ROUTES.BOOKINGS, match: ['booking'],
    allowed: (code) => can(code, 'bookings') },
  { label: 'Doctor timings', icon: 'pi pi-calendar-clock', route: ROUTES.TIMINGS, match: ['timing'],
    allowed: (code) => can(code, 'timings') },
  { label: 'Forms', icon: 'pi pi-file-edit', route: ROUTES.FORMS, match: ['form', 'submission'],
    allowed: (code) => can(code, 'forms') || hasPageLike(code, 'form:') },
  { label: 'Lists', icon: 'pi pi-table', route: ROUTES.LISTS, match: ['list'],
    allowed: (code) => can(code, 'lists') || hasPageLike(code, 'list:') },
  { label: 'Users', icon: 'pi pi-users', route: ROUTES.USERS, match: ['user'], allowed: isAdmin },
  { label: 'Roles', icon: 'pi pi-shield', route: ROUTES.ROLES, match: ['role'], allowed: isAdmin },
  { label: 'Clinic settings', icon: 'pi pi-cog', route: ROUTES.SETTINGS, match: ['setting'], allowed: isAdmin }
])

// Forms and lists use the same three views; these route names differ per kind.
export const KIND_ROUTES = Object.freeze({
  form: { index: ROUTES.FORMS, builder: ROUTES.FORM_BUILDER, rows: ROUTES.SUBMISSIONS },
  list: { index: ROUTES.LISTS, builder: ROUTES.LIST_BUILDER, rows: ROUTES.LIST_ROWS }
})

const DefinitionsView = () => import('@/views/definitions/DefinitionsView.vue')
const BuilderView = () => import('@/views/definitions/BuilderView.vue')
const RecordsView = () => import('@/views/definitions/RecordsView.vue')

// URLs use names, not ids: /tenants/<tenant code>/forms/<link name>
const tenant = '/tenants/:tenantCode'
const kindRoutes = (kind, path, label) => [
  { path: `${tenant}/${path}`, name: KIND_ROUTES[kind].index, component: DefinitionsView,
    props: (r) => ({ ...r.params, kind }), meta: { title: label } },
  { path: `${tenant}/${path}/:slug`, name: KIND_ROUTES[kind].builder, component: BuilderView,
    props: (r) => ({ ...r.params, kind }), meta: { title: `${label} builder` } },
  { path: `${tenant}/${path}/:slug/${kind === 'form' ? 'submissions' : 'rows'}`, name: KIND_ROUTES[kind].rows,
    component: RecordsView, props: (r) => ({ ...r.params, kind }),
    meta: { title: kind === 'form' ? 'Submissions' : 'Rows' } }
]

const routes = [
  // '/' and a clinic's own address go to the right page once the user is known (see beforeEach).
  { path: '/', name: 'home', component: { render: () => null } },
  { path: '/tenants', name: ROUTES.TENANTS, component: () => import('@/views/tenants/TenantsView.vue'),
    meta: { title: 'Tenants' } },
  { path: '/messaging', name: ROUTES.MESSAGING, component: () => import('@/views/settings/MessagingView.vue'),
    meta: { title: 'Messaging' } },
  ...kindRoutes('form', 'forms', 'Forms'),
  ...kindRoutes('list', 'lists', 'Lists'),
  { path: `${tenant}/timings`, name: ROUTES.TIMINGS, props: true, meta: { title: 'Doctor timings' },
    component: () => import('@/views/schedules/TimingsView.vue') },
  { path: `${tenant}/schedules/:rest(.*)*`, redirect: (to) => ({ name: ROUTES.TIMINGS, params: { tenantCode: to.params.tenantCode } }) },
  { path: `${tenant}/settings`, name: ROUTES.SETTINGS, props: true, meta: { title: 'Clinic settings' },
    component: () => import('@/views/settings/ClinicSettingsView.vue') },
  { path: `${tenant}/bookings`, name: ROUTES.BOOKINGS, props: true, meta: { title: 'Bookings' },
    component: () => import('@/views/schedules/BookingsView.vue') },
  { path: `${tenant}/users`, name: ROUTES.USERS, props: true, meta: { title: 'Users' },
    component: () => import('@/views/people/UsersView.vue') },
  { path: `${tenant}/roles`, name: ROUTES.ROLES, props: true, meta: { title: 'Roles' },
    component: () => import('@/views/people/RolesView.vue') },
  // Opening a clinic goes to its first tab the user may see.
  { path: tenant, name: 'clinic', component: { render: () => null } },
  { path: '/login', name: ROUTES.LOGIN, meta: { title: 'Log in', guest: true },
    component: () => import('@/views/auth/LoginView.vue') },
  { path: '/password', name: ROUTES.PASSWORD, meta: { title: 'Change password', bare: true },
    component: () => import('@/views/auth/PasswordView.vue') },
  // Public page for patients: no admin header, no login.
  { path: '/f/:tenantCode/:formSlug', name: ROUTES.PUBLIC_FORM, props: true, meta: { title: 'Form', public: true },
    component: () => import('@/views/public/PublicFormView.vue') },
  // Live queue (no login): a patient's own token and the clinic's lobby screen
  { path: '/q/:tenantCode/:code', name: 'my-token', props: true, meta: { title: 'Your token', public: true },
    component: () => import('@/views/public/QueueView.vue') },
  { path: '/tv/:tenantCode/:screenKey', name: 'lobby', props: true, meta: { title: 'Queue', public: true },
    component: () => import('@/views/public/LobbyView.vue') },
  { path: '/:pathMatch(.*)*', redirect: { name: ROUTES.TENANTS } }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Where a clinic opens: its first tab the user may see.
export function clinicHome(tenantCode) {
  const tab = CLINIC_TABS.find((t) => t.allowed(tenantCode)) || CLINIC_TABS[0]
  return { name: tab.route, params: { tenantCode } }
}

// After login: platform admins and people in several clinics see the clinic list; others their clinic.
export function home() {
  if (!isPlatformAdmin.value && clinics.value.length === 1) return clinicHome(clinics.value[0].code)
  return { name: ROUTES.TENANTS }
}

// Every page except the public form and the login page needs a login; a temporary password must be
// changed first.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  await loadUser()
  if (to.meta.guest) return user.value ? home() : true
  if (!user.value) return { name: ROUTES.LOGIN, query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  if (mustChangePassword.value && to.name !== ROUTES.PASSWORD) return { name: ROUTES.PASSWORD }
  if (to.name === 'home') return home()
  if (to.name === 'clinic') return clinicHome(to.params.tenantCode)
  return true
})

router.afterEach((to) => {
  if (to.meta.public) return // the public page sets its own title (the form name)
  document.title = to.meta.title ? `${to.meta.title} · ${appConfig.title}` : appConfig.title
})

export default router
