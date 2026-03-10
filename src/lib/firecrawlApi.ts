// Firecrawl API client
// Docs: https://docs.firecrawl.dev
// Key: VITE_FIRECRAWL_KEY in .env.local

const BASE = 'https://api.firecrawl.dev/v1'

function getKey(): string | null {
  return import.meta.env.VITE_FIRECRAWL_KEY ?? null
}

export interface ScrapeResult {
  url: string
  markdown: string
  title?: string
}

export interface SearchResult {
  url: string
  title: string
  description: string
  markdown?: string
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const key = getKey()
  if (!key) throw new Error('VITE_FIRECRAWL_KEY is not set in .env.local')

  const res = await fetch(`${BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Firecrawl scrape ${res.status}: ${body}`)
  }

  const data = await res.json() as {
    success: boolean
    data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } }
  }

  if (!data.success || !data.data) {
    throw new Error('Firecrawl scrape returned no data')
  }

  return {
    url: data.data.metadata?.sourceURL ?? url,
    title: data.data.metadata?.title,
    markdown: data.data.markdown ?? '',
  }
}

export async function searchWeb(query: string, limit = 5): Promise<SearchResult[]> {
  const key = getKey()
  if (!key) throw new Error('VITE_FIRECRAWL_KEY is not set in .env.local')

  const res = await fetch(`${BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query, limit }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Firecrawl search ${res.status}: ${body}`)
  }

  const data = await res.json() as {
    success: boolean
    data?: Array<{
      url: string
      title?: string
      description?: string
      markdown?: string
    }>
  }

  if (!data.success || !data.data) return []

  return data.data.map((item) => ({
    url: item.url,
    title: item.title ?? item.url,
    description: item.description ?? '',
    markdown: item.markdown,
  }))
}
