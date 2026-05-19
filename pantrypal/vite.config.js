import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'child_process'
function claudeProxyPlugin() {
  return {
    name: 'claude-proxy',
    configureServer(server) {
      server.middlewares.use('/api/claude-vision', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const { prompt, system, model = 'claude-haiku-4-5', imageData } = JSON.parse(Buffer.concat(chunks).toString())

        try {
          const result = await runClaudeVision(prompt, model, system, imageData)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })

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

function parseClaudeOutput(stdout, model) {
  const parsed = JSON.parse(stdout)
  const modelEntry = Object.entries(parsed.modelUsage || {}).find(
    ([key]) => key === model || key.startsWith(model)
  )
  const modelUsage = modelEntry?.[1] ?? {}
  return {
    text: parsed.result || '',
    usage: {
      inputTokens:      parsed.usage?.input_tokens ?? 0,
      outputTokens:     parsed.usage?.output_tokens ?? 0,
      cacheReadTokens:  parsed.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: parsed.usage?.cache_creation_input_tokens ?? 0,
      costUSD:          parsed.total_cost_usd ?? modelUsage.costUSD ?? 0,
      durationMs:       parsed.duration_ms ?? 0,
      model:            modelEntry?.[0] ?? model,
    },
  }
}

function runClaude(prompt, model, systemPrompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--input-format', 'text', '--model', model, '--output-format', 'json']
    if (systemPrompt) args.push('--system-prompt', systemPrompt)

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => (stdout += d))
    proc.stderr.on('data', (d) => (stderr += d))

    proc.on('close', (code) => {
      if (code !== 0) { reject(new Error(`Claude CLI error: ${stderr || 'unknown error'}`)); return }
      try { resolve(parseClaudeOutput(stdout, model)) }
      catch { reject(new Error('Failed to parse Claude CLI output')) }
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

function runClaudeVision(prompt, model, systemPrompt, imageData) {
  return new Promise((resolve, reject) => {
    // stream-json input requires stream-json output + --verbose
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model]
    if (systemPrompt) args.push('--system-prompt', systemPrompt)

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => (stdout += d))
    proc.stderr.on('data', (d) => (stderr += d))

    proc.on('close', (code) => {
      if (code !== 0) { reject(new Error(`Claude CLI error: ${stderr || 'unknown error'}`)); return }
      try {
        // Find the final result object in the NDJSON stream
        const resultObj = stdout.split('\n')
          .filter(Boolean)
          .map(l => { try { return JSON.parse(l) } catch { return null } })
          .filter(Boolean)
          .find(o => o.type === 'result')

        if (!resultObj) throw new Error('No result found in Claude output')

        const modelEntry = Object.entries(resultObj.modelUsage || {}).find(
          ([key]) => key === model || key.startsWith(model)
        )
        const modelUsage = modelEntry?.[1] ?? {}

        resolve({
          text: resultObj.result || '',
          usage: {
            inputTokens:      resultObj.usage?.input_tokens ?? 0,
            outputTokens:     resultObj.usage?.output_tokens ?? 0,
            cacheReadTokens:  resultObj.usage?.cache_read_input_tokens ?? 0,
            cacheWriteTokens: resultObj.usage?.cache_creation_input_tokens ?? 0,
            costUSD:          resultObj.total_cost_usd ?? modelUsage.costUSD ?? 0,
            durationMs:       resultObj.duration_ms ?? 0,
            model:            modelEntry?.[0] ?? model,
          },
        })
      } catch (e) { reject(new Error('Failed to parse Claude CLI output: ' + e.message)) }
    })

    const message = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.data } },
          { type: 'text', text: prompt },
        ],
      },
    })
    proc.stdin.write(message + '\n')
    proc.stdin.end()
  })
}

export default defineConfig({
  plugins: [tailwindcss(), react(), claudeProxyPlugin()],
})
