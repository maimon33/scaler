import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/scaler/',
  plugins: [react()],
  build: {
    target: 'esnext',
  },
})
