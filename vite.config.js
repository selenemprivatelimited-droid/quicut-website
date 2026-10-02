import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// base './' so the build works on GitHub Pages under /<repo>/ and on any static host.
// Two pages: the marketing site (index.html) and the app (app.html).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        apply: resolve(__dirname, 'apply/index.html'),
      },
    },
  },
})
