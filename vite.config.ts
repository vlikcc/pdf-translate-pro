import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/pdftranslator/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs',
    },
  },
  build: {
    target: ['es2020', 'safari14'],
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
