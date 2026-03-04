const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

export interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

// S-07: context is empty string; S-08 will inject the real graph
export function buildSystemPrompt(contextMarkdown = '', nodeCount = 0): string {
  const timestamp = new Date().toISOString()
  const contextSection =
    contextMarkdown.length > 0
      ? `[CONTEXT GRAPH — ${nodeCount} nodes, exported ${timestamp}]\n${contextMarkdown}\n[END CONTEXT]`
      : '[CONTEXT GRAPH — not yet connected]\n[END CONTEXT]'

  const layoutDirective = [
    'You can control the GUI layout. When your response would benefit from a specific panel being',
    'in focus, include a layout directive. Valid panel types: context, map, chat, log, delta,',
    'trading, comms, terminal, browser.',
    'Include it only when a layout change genuinely helps. Omit when no change is needed.',
    'Format (include in your response, will be stripped before display):',
    'KORTANA_LAYOUT',
    '{"focus": "panel_type", "support": ["type1", "type2", "type3"], "reason": "brief reason"}',
    'END_LAYOUT',
  ].join('\n')

  return [
    'You are Kortana — a persistent AI collaborator embedded in Kortana GUI.',
    'You are not a general assistant. You operate Barack\'s ops centre.',
    'Your context store runs at localhost:4000.',
    'Barack is a Principal Data Engineer. Be direct, concrete, and production-quality.',
    '',
    layoutDirective,
    '',
    contextSection,
  ].join('\n')
}

export async function streamMessage(
  messages: ApiMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (!key) {
    callbacks.onError(new Error('VITE_ANTHROPIC_KEY is not set in .env.local'))
    return
  }

  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    })
  } catch (err) {
    callbacks.onError(new Error(`Network error: ${String(err)}`))
    return
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    callbacks.onError(new Error(`Anthropic API ${res.status}: ${body}`))
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('Response body is not readable'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue

        try {
          const event = JSON.parse(data)
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            typeof event.delta.text === 'string'
          ) {
            callbacks.onChunk(event.delta.text)
          }
        } catch {
          // skip malformed SSE events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  callbacks.onDone()
}
