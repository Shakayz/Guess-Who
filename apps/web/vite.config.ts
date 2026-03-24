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
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so the port is reachable inside Docker
    proxy: {
      '/api':      { target: process.env.API_TARGET ?? 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: process.env.API_TARGET ?? 'http://localhost:3001', ws: true },
    },
  },
})
