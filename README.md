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

