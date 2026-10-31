import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const token = (process.env.VITE_MAPBOX_TOKEN ?? env.VITE_MAPBOX_TOKEN ?? '').trim()
  if (token && !token.startsWith('pk.')) {
    throw new Error('VITE_MAPBOX_TOKEN must be a scoped public Mapbox token starting with pk.; never use a secret token.')
  }
  return { plugins: [react()], define: { 'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(token) } }
})
