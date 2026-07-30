import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large third-party libraries into their own long-lived chunks so
        // they cache across deploys (app code changes far more often than these)
        // and don't bloat the main entry bundle. The map stack in particular is
        // only needed on the dashboards, which are already route-split.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'map-vendor': ['leaflet', 'react-leaflet', 'topojson-client'],
          'i18n-vendor': ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
