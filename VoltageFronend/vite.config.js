import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build natijasi FastAPI tomonidan (port 5000) beriladi va nginx orqali
// chiroqbor.ssmart.uz subdomenining root '/' yo'lida ko'rsatiladi — shuning uchun
// base='/' (prod va dev bir xil). Dev rejimida (vite, port 5173) quyidagi proxy
// HTTP/SSE so'rovlarni mahalliy FastAPI backendga to'g'ridan-to'g'ri uzatadi.
const backend = { target: 'http://localhost:5000', changeOrigin: true }

export default defineConfig(() => ({
  base: '/',
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
