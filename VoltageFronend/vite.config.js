import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build natijasi FastAPI tomonidan (port 5000) beriladi va nginx orqali
// ssmart.uz/Voltage/ subpath'ida ko'rsatiladi — shuning uchun build'da base='/Voltage/'.
// Dev rejimida (vite, port 5173) esa base='/' qoldiramiz, shunda quyidagi proxy
// HTTP/SSE so'rovlarni mahalliy FastAPI backendga to'g'ridan-to'g'ri uzatadi.
const backend = { target: 'http://localhost:5000', changeOrigin: true }

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Voltage/' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    proxy: {
      '/auth': backend,
      '/devices': backend,
      '/media': backend,
      '/events': backend,
      '/status': backend,
      '/update': backend,
      '/healthz': backend,
    },
  },
}))
