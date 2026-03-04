const NODES_URL = 'http://localhost:4000/nodes'
const FILE_CONTEXT_URL = '/api/context'
const CACHE_TTL_MS = 30_000

interface ContextSnapshot {
  nodeCount: number
  markdown: string
  fetchedAt: number
  source: 'api' | 'file' | null
  error: string | null
}

// Module-level cache — shared across all callers
let cache: ContextSnapshot | null = null

function formatMarkdown(nodes: Record<string, unknown>[]): string {
  if (nodes.length === 0) return ''

  // Group by type
  const groups: Record<string, typeof nodes> = {}
  for (const node of nodes) {
    const t = String(node.type ?? 'Unknown')
    if (!groups[t]) groups[t] = []
    groups[t].push(node)
  }

  const lines: string[] = [`## Context Graph (${nodes.length} nodes)\n`]

  for (const [type, members] of Object.entries(groups)) {
    lines.push(`### ${type}`)
    for (const n of members) {
      const status = n.status ? ` (${n.status})` : ''
      lines.push(`- [${n.id}] ${n.label}${status}`)
      // Include body for high-signal node types
      if (n.body && ['Decision', 'Requirement', 'Constraint', 'Risk'].includes(String(n.type))) {
        lines.push(`  > ${String(n.body).replace(/\n/g, ' ').slice(0, 200)}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function getContextSnapshot(): Promise<ContextSnapshot> {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache

  // Tier 1: context store API
  try {
    const res = await fetch(NODES_URL)
    if (res.ok) {
      const nodes: Record<string, unknown>[] = await res.json()
      cache = {
        nodeCount: nodes.length,
        markdown: formatMarkdown(nodes),
        fetchedAt: now,
        source: 'api',
        error: null,
      }
      return cache
    }
  } catch { /* fall through */ }

  // Tier 2: local CONTEXT.md file via Vite dev server middleware
  try {
    const res = await fetch(FILE_CONTEXT_URL)
    if (res.ok) {
      const data = await res.json() as { content: string; source: string }
      cache = {
        nodeCount: 0,
        markdown: data.content,
        fetchedAt: now,
        source: 'file',
        error: null,
      }
      return cache
    }
  } catch { /* fall through */ }

  // Both unavailable — keep stale cache if available
  cache = {
    nodeCount: cache?.nodeCount ?? 0,
    markdown: cache?.markdown ?? '',
    fetchedAt: now,
    source: null,
    error: 'Context store and file fallback both unavailable',
  }
  return cache
}
