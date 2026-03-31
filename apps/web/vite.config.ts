import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'i18n': ['i18next', 'react-i18next'],
          'socket': ['socket.io-client'],
          'zustand': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['sonly-unanimating-gemma.ngrok-free.dev'],
    proxy: {
      '/api':       { target: process.env.API_TARGET ?? 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: process.env.API_TARGET ?? 'http://localhost:3001', ws: true },
    },
  },
})
