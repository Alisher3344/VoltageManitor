import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build natijasi FastAPI tomonidan (port 5000) bir xil originda beriladi,
// shuning uchun base '/' qoldiramiz.
// Dev rejimida (vite, port 5173) HTTP/SSE so'rovlarni FastAPI backendga proxy qilamiz.
const backend = { target: 'http://localhost:5000', changeOrigin: true }

export default defineConfig({
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
})
