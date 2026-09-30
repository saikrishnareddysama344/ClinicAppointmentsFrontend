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

## Automated tests

They live in the separate `tests` folder next to `frontend` and `backend`; see its README.

## Settings

One optional file, `frontend/.env`, to change the title, API address, dev port,
date locale, notification time or dark mode. Builder rules (reserved names, limits, dropdown
sources) are not set here; they come from the backend at `GET /v1/meta/builder`.

On Render, set `VITE_API_BASE_URL` (the backend address) in the static site's Environment tab.

## Folder layout

```
src/
├── main.js                 App bootstrap (PrimeVue components registered here, router, toasts)
├── config/env.js           Reads VITE_* settings (only place that touches import.meta.env)
├── router/index.js         Routes; forms and lists share three views (kind = form | list)
├── services/
│   ├── http.js             fetch wrapper + ApiError
│   └── api.js              Every backend endpoint (one factory for forms and lists)
├── composables/
│   ├── useBuilderConfig.js Builder rules + field types from the API (loaded once)
│   ├── useBuilder.js       State and actions for editing a form or a list
│   ├── useCatalog.js       A tenant's lists and schedules (pickers, list options)
│   ├── useTenant.js        Tenant details, fetched once per tenant
│   └── useNotify.js        Toast helpers
├── constants/              UI-only mappings (icons, input kinds, status names)
├── utils/format.js         Dates, display values, column-name preview, API field -> renderer field
├── components/
│   ├── layout/AppHeader.vue, TenantNav.vue (breadcrumb + Forms | Lists | Schedules | Bookings)
│   ├── common/FormStatusTag.vue
│   ├── builder/FieldList.vue, FieldSettings.vue, SharePanel.vue
│   └── forms/FormRenderer.vue, SlotPicker.vue
├── views/
│   ├── tenants/TenantsView.vue
│   ├── definitions/DefinitionsView.vue, BuilderView.vue, RecordsView.vue   (forms and lists)
│   ├── schedules/SchedulesView.vue, ScheduleView.vue, BookingsView.vue
│   └── public/PublicFormView.vue     The page patients see (/f/<code>/<slug>)
└── assets/styles/main.css
```
