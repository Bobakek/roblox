import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // 0.0.0.0 — доступно извне контейнера
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 443 } // для *.app.github.dev (HTTPS-прокси)
  }
})
