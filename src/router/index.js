import { createRouter, createWebHistory } from 'vue-router'
import { appConfig } from '@/config/env'

export const ROUTES = Object.freeze({
  TENANTS: 'tenants',
  FORMS: 'forms',
  FORM_BUILDER: 'form-builder',
  SUBMISSIONS: 'submissions',
  PUBLIC_FORM: 'public-form'
})

// URLs use names, not ids: /tenants/<tenant code>/forms/<form link name>
const routes = [
  { path: '/', redirect: { name: ROUTES.TENANTS } },
  {
    path: '/tenants',
    name: ROUTES.TENANTS,
    component: () => import('@/views/tenants/TenantsView.vue'),
    meta: { title: 'Tenants' }
  },
  {
    path: '/tenants/:tenantCode/forms',
    name: ROUTES.FORMS,
    component: () => import('@/views/forms/FormsView.vue'),
    props: true,
    meta: { title: 'Forms' }
  },
  {
    path: '/tenants/:tenantCode/forms/:formSlug',
    name: ROUTES.FORM_BUILDER,
    component: () => import('@/views/forms/FormBuilderView.vue'),
    props: true,
    meta: { title: 'Form builder' }
  },
  {
    path: '/tenants/:tenantCode/forms/:formSlug/submissions',
    name: ROUTES.SUBMISSIONS,
    component: () => import('@/views/forms/SubmissionsView.vue'),
    props: true,
    meta: { title: 'Submissions' }
  },
  // Public page for patients: no admin header, no login.
  {
    path: '/f/:tenantCode/:formSlug',
    name: ROUTES.PUBLIC_FORM,
    component: () => import('@/views/public/PublicFormView.vue'),
    props: true,
    meta: { title: 'Form', public: true }
  },
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
