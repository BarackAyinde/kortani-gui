import { type ChangeEvent, useCallback, useMemo, useState } from 'react'
import { marked } from 'marked'

const STORAGE_KEY = 'kortana.brief'

const DEFAULT_BRIEF = `# Intelligence Brief

## Operator
Barack Ayinde · Principal Data Engineer

## Active Projects

### Rackstack Platform
- Phase 1 — HTTP/WS server · **COMPLETE**
- Phase 2 — Graph CRUD + delta · **COMPLETE**

### Kortana GUI
- Phase 1 — Foundation · **COMPLETE**
- Phase 2 — Chat sidebar · **COMPLETE**
- Phase 3 — Canvas engine · **COMPLETE**
- Phase 4 — Dashboard mode · **COMPLETE**
- Phase 5 — Polish · **IN PROGRESS**

## Context Store
- Endpoint: \`http://localhost:4000\`
- Protocol: REST + WebSocket
- Schema: nodes + edges (better-sqlite3)

## Standing Instructions
- Production-quality, concrete, incremental
- One file at a time with confirmation
- JetBrains Mono everywhere
- CSS vars for all colours — no hardcoded hex
`

function loadContent(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BRIEF
  } catch {
    return DEFAULT_BRIEF
  }
}

type Mode = 'view' | 'edit'

export default function MarkdownPanel() {
  const [content, setContent] = useState<string>(loadContent)
  const [mode, setMode] = useState<Mode>('view')

  const html = useMemo(() => marked.parse(content) as string, [content])

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setContent(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch { /* storage full */ }
  }, [])

  return (
    <div className="md-panel">
      <div className="md-panel__header">
        <button
          className={`md-tab${mode === 'view' ? ' md-tab--active' : ''}`}
          onClick={() => setMode('view')}
        >
          VIEW
        </button>
        <button
          className={`md-tab${mode === 'edit' ? ' md-tab--active' : ''}`}
          onClick={() => setMode('edit')}
        >
          EDIT
        </button>
        <span className="md-panel__chars">{content.length} chars</span>
      </div>

      {mode === 'view' ? (
        <div
          className="md-panel__rendered"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <textarea
          className="md-panel__editor"
          value={content}
          onChange={handleChange}
          spellCheck={false}
        />
      )}
    </div>
  )
}
