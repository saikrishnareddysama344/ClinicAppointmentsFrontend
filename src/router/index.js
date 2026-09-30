import { createRouter, createWebHistory } from 'vue-router'
import { appConfig } from '@/config/env'

export const ROUTES = Object.freeze({
  TENANTS: 'tenants',
  FORMS: 'forms',
  FORM_BUILDER: 'form-builder',
  SUBMISSIONS: 'submissions',
  LISTS: 'lists',
  LIST_BUILDER: 'list-builder',
  LIST_ROWS: 'list-rows',
  SCHEDULES: 'schedules',
  SCHEDULE: 'schedule',
  BOOKINGS: 'bookings',
  PUBLIC_FORM: 'public-form'
})

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
  { path: '/', redirect: { name: ROUTES.TENANTS } },
  { path: '/tenants', name: ROUTES.TENANTS, component: () => import('@/views/tenants/TenantsView.vue'),
    meta: { title: 'Tenants' } },
  ...kindRoutes('form', 'forms', 'Forms'),
  ...kindRoutes('list', 'lists', 'Lists'),
  { path: `${tenant}/schedules`, name: ROUTES.SCHEDULES, props: true, meta: { title: 'Schedules' },
    component: () => import('@/views/schedules/SchedulesView.vue') },
  { path: `${tenant}/schedules/:slug`, name: ROUTES.SCHEDULE, props: true, meta: { title: 'Schedule' },
    component: () => import('@/views/schedules/ScheduleView.vue') },
  { path: `${tenant}/bookings`, name: ROUTES.BOOKINGS, props: true, meta: { title: 'Bookings' },
    component: () => import('@/views/schedules/BookingsView.vue') },
  // Public page for patients: no admin header, no login.
  { path: '/f/:tenantCode/:formSlug', name: ROUTES.PUBLIC_FORM, props: true, meta: { title: 'Form', public: true },
    component: () => import('@/views/public/PublicFormView.vue') },
  { path: '/:pathMatch(.*)*', redirect: { name: ROUTES.TENANTS } }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.afterEach((to) => {
  if (to.meta.public) return // the public page sets its own title (the form name)
  document.title = to.meta.title ? `${to.meta.title} · ${appConfig.title}` : appConfig.title
})

export default router
