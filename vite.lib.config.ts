import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Library build (`npm run build:lib`) — consumer-facing ESM output in dist/.
// react/react-dom are externalized (see peerDependencies in package.json),
// including react/jsx-runtime which the automatic JSX transform imports.
//
// Card art assets are NOT part of the package: public/ is not copied into the
// lib build (copyPublicDir: false) — consumers ship their own /cards/ directory.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        engine: 'src/engine/index.ts',
        renderer: 'src/renderer/index.ts',
        contract: 'src/contract/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
