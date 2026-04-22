import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import { apiPlugin } from './server/vite-api-plugin'

loadEnv()

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
