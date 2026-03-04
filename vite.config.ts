import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'context-server',
      configureServer(server) {
        server.middlewares.use('/api/context', (_req, res) => {
          const contextPath =
            process.env.KORTANA_CONTEXT_PATH ??
            path.join(process.env.HOME ?? '', 'code/kortana/CONTEXT.md')
          try {
            const content = fs.readFileSync(contextPath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ content, source: 'file', path: contextPath }))
          } catch {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'CONTEXT.md not found', path: contextPath }))
          }
        })
      },
    },
  ],
})
