import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4301,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4300',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})


