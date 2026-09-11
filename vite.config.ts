import { defineConfig } from 'vite'

export default defineConfig({
  // TODO: Replace '<REPO_NAME>' with your actual GitHub repository name before deploying.
  // Example: if your repo is https://github.com/youruser/hr-portal, set base: '/hr-portal/'
  base: '/hr-err/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
})
