import type { LayoutDirective } from '../types'

interface ParseResult {
  directive: LayoutDirective | null
  cleanContent: string
}

export function parseLayoutDirective(content: string): ParseResult {
  const match = content.match(/KORTANA_LAYOUT\n([\s\S]*?)\nEND_LAYOUT/)
  if (!match) return { directive: null, cleanContent: content }

  try {
    const directive = JSON.parse(match[1]) as LayoutDirective
    const cleanContent = content
      .replace(/KORTANA_LAYOUT\n[\s\S]*?\nEND_LAYOUT\n?/, '')
      .trim()
    return { directive, cleanContent }
  } catch {
    // Malformed directive — show content as-is, no layout change
    return { directive: null, cleanContent: content }
  }
}
