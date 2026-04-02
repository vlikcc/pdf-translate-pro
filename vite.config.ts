import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/pdftranslator/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
