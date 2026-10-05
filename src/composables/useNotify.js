// Toast shortcuts so every view shows messages the same way.
import { useToast } from 'primevue/usetoast'
import { appConfig } from '@/config/env'

export function useNotify() {
  const toast = useToast()
  const life = appConfig.toastLifeMs

  return {
    success: (summary, detail) => toast.add({ severity: 'success', summary, detail, life }),
    info: (summary, detail) => toast.add({ severity: 'info', summary, detail, life }),
    warn: (summary, detail) => toast.add({ severity: 'warn', summary, detail, life: life * 2 }),
    error: (summary, error) => toast.add({
      severity: 'error', summary, detail: error?.message || String(error || ''), life: life * 1.5
    })
  }
}
