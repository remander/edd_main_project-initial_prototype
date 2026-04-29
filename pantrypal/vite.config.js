import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'child_process'

function claudeProxyPlugin() {
  return {
    name: 'claude-proxy',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const { prompt, system, model = 'claude-haiku-4-5' } = JSON.parse(Buffer.concat(chunks).toString())

        try {
          const result = await runClaude(prompt, model, system)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

function runClaude(prompt, model, systemPrompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', model, '--output-format', 'json']
    if (systemPrompt) args.push('--system-prompt', systemPrompt)

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => (stdout += d))
    proc.stderr.on('data', (d) => (stderr += d))

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI error: ${stderr || 'unknown error'}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout)

        // Pull out the primary model's usage (ignore claude-code overhead models)
        const modelEntry = Object.entries(parsed.modelUsage || {}).find(
          ([key]) => key === model || key.startsWith(model)
        )
        const modelUsage = modelEntry?.[1] ?? {}

        const usage = {
          inputTokens:      parsed.usage?.input_tokens ?? 0,
          outputTokens:     parsed.usage?.output_tokens ?? 0,
          cacheReadTokens:  parsed.usage?.cache_read_input_tokens ?? 0,
          cacheWriteTokens: parsed.usage?.cache_creation_input_tokens ?? 0,
          costUSD:          parsed.total_cost_usd ?? modelUsage.costUSD ?? 0,
          durationMs:       parsed.duration_ms ?? 0,
          model:            modelEntry?.[0] ?? model,
        }

        resolve({ text: parsed.result || '', usage })
      } catch {
        reject(new Error('Failed to parse Claude CLI output'))
      }
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

export default defineConfig({
  plugins: [tailwindcss(), react(), claudeProxyPlugin()],
})
