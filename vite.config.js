import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Settings come from frontend/.env (optional; names in src/config/env.js). The fallbacks match the backend defaults.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        '/v1': { target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000', changeOrigin: true }
      }
    }
  }
})
