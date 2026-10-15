import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // app build output — lib stays in dist/ for file:-consumers
    outDir: 'dist-app',
    emptyOutDir: true,
  },
})
