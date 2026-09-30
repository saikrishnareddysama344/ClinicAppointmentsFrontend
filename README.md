# Frontend (admin console)

Vue 3 + PrimeVue 4 + Vite. Needs Node.js 20.19+ or 22.12+.

## Run

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (or the port in `VITE_DEV_PORT`). Start the backend first.
The header shows a green **API** dot when the backend and database are reachable.

## Automated tests (Playwright)

First time only:
```
npm install
npm run test:e2e:install      (downloads the Chromium browser for tests)
```

Run everything (API tests + browser tests):
```
npm run test:e2e
```

- It starts its **own** backend (port 5055) and frontend (port 5174), so it can run while your
  normal dev servers are running.
- It uses your database, but only the test schemas `e2e_config` and `e2e_t_*`, which are
  wiped before and after each run. Your real `app_config` and `t_*` data is never touched
  (the backend refuses to wipe any schema not starting with `e2e_` or `test_`).
- `npm run test:e2e:api` runs only the API tests; `npm run test:e2e:ui` only the browser tests;
  `npm run test:e2e:headed` shows the browser while it clicks.
- After a failure, `npm run test:e2e:report` opens a report with screenshots, a video and a
  step-by-step trace of what went wrong. Set `E2E_KEEP_DATA=1` to keep the test data.

## Settings

One optional file, `frontend/.env`, to change the title, API address, dev port,
date locale, notification time or dark mode. Builder rules (reserved names, limits, dropdown
sources) are not set here; they come from the backend at `GET /v1/meta/builder`.

On Render, set `VITE_API_BASE_URL` (the backend address) in the static site's Environment tab.

## Folder layout

```
src/
├── main.js                 App bootstrap (PrimeVue, router, toasts)
├── App.vue
├── config/env.js           Reads VITE_* settings (only place that touches import.meta.env)
├── router/index.js         Routes and route names
├── services/
│   ├── http.js             fetch wrapper + ApiError
│   └── api.js              Every backend endpoint
├── composables/
│   ├── useBuilderConfig.js Builder rules + field types from the API (loaded once)
│   ├── useFormBuilder.js   State and actions for editing a form
│   └── useNotify.js        Toast helpers
├── constants/              UI-only mappings (icons, input kinds, status names)
├── utils/format.js         Dates, column-name preview, tenant code
├── components/
│   ├── layout/AppHeader.vue
│   ├── common/FormStatusTag.vue
│   ├── builder/FieldList.vue, FieldSettings.vue, SharePanel.vue
│   └── forms/FormRenderer.vue
├── views/
│   ├── tenants/TenantsView.vue
│   ├── forms/FormsView.vue, FormBuilderView.vue, SubmissionsView.vue
│   └── public/PublicFormView.vue     The page patients see (/f/<code>/<slug>)
└── assets/styles/main.css
```

tests/e2e/                  Playwright tests (see "Automated tests" above)
├── api/forms.spec.js       Every backend endpoint
└── ui/booking-flow.spec.js Build, publish, submit as a patient, see the response
