import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Edge Function과 같은 파일을 브라우저에서도 씀 (match.ts 등)
      '@shared': path.resolve(import.meta.dirname, './supabase/functions/_shared'),
    },
  },
})
