import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
})
