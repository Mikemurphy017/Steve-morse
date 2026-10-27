import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In development, run `npm run server` alongside `npm run dev`.
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
