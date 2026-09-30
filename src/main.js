import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'

// PrimeVue components used across the app, registered once here so
// .vue files can use them without importing. Add new ones to this list.
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'

import App from './App.vue'
import router from './router'
import { appConfig } from './config/env'
import './assets/styles/main.css'

const primeComponents = {
  Button, Checkbox, Column, ConfirmDialog, DataTable, DatePicker, Dialog, InputNumber,
  InputText, Menu, Message, MultiSelect, Select, SelectButton, Tag, Textarea, Toast, ToggleSwitch
}

document.title = appConfig.title

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: { darkModeSelector: appConfig.darkMode }
  }
})
app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)

for (const [name, component] of Object.entries(primeComponents)) {
  app.component(name, component)
}

app.use(router)
app.mount('#app')
