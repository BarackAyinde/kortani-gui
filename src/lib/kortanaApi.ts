import { scrapeUrl, searchWeb } from './firecrawlApi'
import { useBrowserStore } from '../store/browserStore'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const OLLAMA_URL = 'http://localhost:11434/v1/chat/completions'

export interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

function providerFor(model: string): 'anthropic' | 'ollama' | 'google' {
  if (model.startsWith('claude-')) return 'anthropic'
  if (model.startsWith('gemini-')) return 'google'
  return 'ollama'
}

// ─── System prompt ────────────────────────────────────────────────────────────

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
    'You have web browsing tools (scrape_url, search_web) via Firecrawl. Use them when Barack asks',
    'you to research something, find information, or when a news signal warrants investigation.',
    'When you browse a URL, the BrowserPanel will automatically display it.',
    '',
    layoutDirective,
    '',
    contextSection,
  ].join('\n')
}

// ─── Firecrawl tool definitions ───────────────────────────────────────────────

const FIRECRAWL_TOOLS = [
  {
    name: 'scrape_url',
    description:
      'Scrape a URL and return its full content as markdown. Use this to read web pages, articles, documentation, or any public URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The full URL to scrape (must include https://)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_web',
    description:
      'Search the web for a topic and return a list of results with titles, descriptions, and content. Use this to research topics, find recent news, or gather information.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        limit: { type: 'number', description: 'Max results to return (default 5, max 10)' },
      },
      required: ['query'],
    },
  },
]

// ─── Anthropic content block types (SSE) ─────────────────────────────────────

interface TextBlock {
  type: 'text'
  text: string
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  inputJson: string // accumulated partial JSON
}

type ContentBlock = TextBlock | ToolUseBlock

// ─── Execute a single Firecrawl tool call ─────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'scrape_url') {
    const url = input.url as string
    // Drive the BrowserPanel to show the URL being scraped
    useBrowserStore.getState().navigateTo(url, true)
    const result = await scrapeUrl(url)
    useBrowserStore.getState().setLastScrape(result.markdown)
    const header = `# ${result.title ?? url}\nSource: ${result.url}\n\n`
    // Truncate to avoid blowing up the context window
    const body = result.markdown.slice(0, 8000)
    return header + body + (result.markdown.length > 8000 ? '\n\n[truncated]' : '')
  }

  if (name === 'search_web') {
    const query = input.query as string
    const limit = typeof input.limit === 'number' ? input.limit : 5
    const results = await searchWeb(query, limit)
    if (results.length === 0) return 'No results found.'
    return results
      .map((r, i) => `## ${i + 1}. ${r.title}\n${r.url}\n${r.description}${r.markdown ? '\n\n' + r.markdown.slice(0, 1000) : ''}`)
      .join('\n\n---\n\n')
  }

  return `Unknown tool: ${name}`
}

// ─── Anthropic streaming with tool_use agentic loop ──────────────────────────

// Raw Anthropic API message format (supports content block arrays)
type AnthropicMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | {
      role: 'user'
      content: Array<{
        type: 'tool_result'
        tool_use_id: string
        content: string
      }>
    }
  | {
      role: 'assistant'
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >
    }

async function streamAnthropicTurn(
  messages: AnthropicMessage[],
  systemPrompt: string,
  model: string,
  key: string,
): Promise<{ blocks: ContentBlock[]; stopReason: string }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: FIRECRAWL_TOOLS,
      messages,
      stream: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${body}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  const blocks: ContentBlock[] = []
  let stopReason = 'end_turn'

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

          if (event.type === 'content_block_start') {
            const cb = event.content_block
            if (cb.type === 'text') {
              blocks[event.index] = { type: 'text', text: '' }
            } else if (cb.type === 'tool_use') {
              blocks[event.index] = { type: 'tool_use', id: cb.id, name: cb.name, inputJson: '' }
            }
          }

          if (event.type === 'content_block_delta') {
            const block = blocks[event.index]
            if (!block) continue
            if (event.delta.type === 'text_delta' && block.type === 'text') {
              block.text += event.delta.text
            } else if (event.delta.type === 'input_json_delta' && block.type === 'tool_use') {
              block.inputJson += event.delta.partial_json
            }
          }

          if (event.type === 'message_delta' && event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason
          }
        } catch {
          // skip malformed SSE events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { blocks, stopReason }
}

async function streamAnthropic(
  messages: ApiMessage[],
  systemPrompt: string,
  model: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (!key) {
    callbacks.onError(new Error('VITE_ANTHROPIC_KEY is not set in .env.local'))
    return
  }

  // Convert simple ApiMessage[] to AnthropicMessage[]
  let turn: AnthropicMessage[] = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  })) as AnthropicMessage[]

  // Agentic loop — continues until end_turn or an error
  const MAX_TOOL_ROUNDS = 5
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let blocks: ContentBlock[]
    let stopReason: string

    try {
      ;({ blocks, stopReason } = await streamAnthropicTurn(turn, systemPrompt, model, key))
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
      return
    }

    // Stream text blocks to the UI
    for (const block of blocks) {
      if (block.type === 'text' && block.text.length > 0) {
        callbacks.onChunk(block.text)
      }
    }

    // If no tool_use, we're done
    if (stopReason !== 'tool_use') {
      callbacks.onDone()
      return
    }

    // Build the assistant turn for conversation history
    const assistantContent: AnthropicMessage['content'] = blocks
      .filter((b): b is TextBlock | ToolUseBlock => b.type === 'text' || b.type === 'tool_use')
      .map((b) => {
        if (b.type === 'text') return { type: 'text' as const, text: b.text }
        return {
          type: 'tool_use' as const,
          id: b.id,
          name: b.name,
          input: (() => {
            try { return JSON.parse(b.inputJson) as Record<string, unknown> } catch { return {} }
          })(),
        }
      }) as AnthropicMessage['content']

    turn = [...turn, { role: 'assistant', content: assistantContent } as AnthropicMessage]

    // Execute all tool calls in this turn
    const toolUseBlocks = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []

    for (const toolBlock of toolUseBlocks) {
      // Show a brief status to the user in the stream
      let input: Record<string, unknown>
      try { input = JSON.parse(toolBlock.inputJson) as Record<string, unknown> } catch { input = {} }

      const statusMsg =
        toolBlock.name === 'scrape_url'
          ? `\n\n_Browsing [${String(input.url)}](${String(input.url)})…_\n\n`
          : `\n\n_Searching: "${String(input.query)}"…_\n\n`
      callbacks.onChunk(statusMsg)

      let resultContent: string
      try {
        resultContent = await executeTool(toolBlock.name, input)
      } catch (err) {
        resultContent = `Tool error: ${err instanceof Error ? err.message : String(err)}`
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: resultContent,
      })
    }

    // Add tool results as the next user turn and continue the loop
    turn = [
      ...turn,
      { role: 'user', content: toolResults } as AnthropicMessage,
    ]
  }

  // Exceeded max rounds
  callbacks.onChunk('\n\n[Max tool rounds reached]')
  callbacks.onDone()
}

// ─── Ollama streaming (OpenAI-compatible) ─────────────────────────────────────

async function readOpenAIStream(res: Response, callbacks: StreamCallbacks): Promise<void> {
  const reader = res.body?.getReader()
  if (!reader) { callbacks.onError(new Error('Response body is not readable')); return }

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
          const chunk = event.choices?.[0]?.delta?.content
          if (typeof chunk === 'string' && chunk.length > 0) callbacks.onChunk(chunk)
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  callbacks.onDone()
}

async function streamOllama(
  messages: ApiMessage[],
  systemPrompt: string,
  model: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const ollamaMessages = [{ role: 'system', content: systemPrompt }, ...messages]
  let res: Response
  try {
    res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
    })
  } catch (err) {
    callbacks.onError(new Error(`Ollama not reachable at localhost:11434 — is it running? (${String(err)})`))
    return
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    callbacks.onError(new Error(`Ollama ${res.status}: ${body}`))
    return
  }
  await readOpenAIStream(res, callbacks)
}

// ─── Google Gemini stub ───────────────────────────────────────────────────────

async function streamGoogle(
  _messages: ApiMessage[],
  _systemPrompt: string,
  model: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  // STUB — Google Gemini integration not yet implemented.
  // To implement: use https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
  // Requires VITE_GOOGLE_KEY in .env.local and a separate SSE parsing path (different format from Anthropic/OpenAI).
  callbacks.onError(
    new Error(
      `Google Gemini (${model}) is not yet integrated. Add VITE_GOOGLE_KEY and implement streamGoogle() in kortanaApi.ts to enable it.`,
    ),
  )
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function streamMessage(
  messages: ApiMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  model?: string,
): Promise<void> {
  const activeModel = model ?? 'claude-sonnet-4-6'
  const provider = providerFor(activeModel)

  if (provider === 'anthropic') return streamAnthropic(messages, systemPrompt, activeModel, callbacks)
  if (provider === 'ollama') return streamOllama(messages, systemPrompt, activeModel, callbacks)
  if (provider === 'google') return streamGoogle(messages, systemPrompt, activeModel, callbacks)

  callbacks.onError(new Error(`Unknown model provider for model: ${activeModel}`))
}
