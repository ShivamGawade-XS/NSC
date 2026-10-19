import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Disable exposed source maps in production
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom') || id.includes('node_modules/zustand')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/leaflet')) {
            return 'vendor-geo';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
        },
      },
    },
  },
})
