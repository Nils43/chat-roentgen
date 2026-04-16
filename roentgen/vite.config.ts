import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleAnalyze } from './server/proxy'
import { config as loadEnv } from 'dotenv'

loadEnv()

// Local dev plugin: mounts POST /api/analyze → Anthropic proxy.
// In production we replace this with a Cloudflare Worker or Vercel function
// that exposes the exact same contract.
function roentgenApiPlugin(): Plugin {
  return {
    name: 'roentgen-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res, next) => {
        if (!req.method || !['POST', 'OPTIONS'].includes(req.method)) return next()
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        handleAnalyze(req, res).catch((err) => {
          if (process.env.ROENTGEN_DEBUG) console.error('[api]', err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'internal' }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), roentgenApiPlugin()],
})
