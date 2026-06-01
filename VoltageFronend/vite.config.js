import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build natijasi Flask tomonidan (port 5000) bir xil originda beriladi,
// shuning uchun base '/' qoldiramiz.
// Dev rejimida (vite, port 5173) SSE/HTTP so'rovlarni Flask backendga proxy qilamiz.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/events': { target: 'http://localhost:5000', changeOrigin: true },
      '/status': { target: 'http://localhost:5000', changeOrigin: true },
      '/update': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
