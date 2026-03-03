import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

const API = 'http://localhost:4000'
const MAX_LINES = 500

type LineKind = 'cmd' | 'stdout' | 'stderr' | 'system'

interface TermLine {
  id: number
  kind: LineKind
  text: string
}

let lineSeq = 0
function makeLine(kind: LineKind, text: string): TermLine {
  return { id: ++lineSeq, kind, text }
}

function isCd(cmd: string): string | null {
  const m = cmd.trim().match(/^cd\s+(.+)$/)
  return m ? m[1]!.trim() : null
}

export default function TerminalPanel() {
  const [lines, setLines] = useState<TermLine[]>([
    makeLine('system', 'kortana terminal — initialising…'),
  ])
  const [cwd, setCwd] = useState<string>('')
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch initial cwd
  useEffect(() => {
    fetch(`${API}/exec`)
      .then((r) => r.json() as Promise<{ cwd: string }>)
      .then(({ cwd: home }) => {
        setCwd(home)
        setLines((prev) => [
          ...prev,
          makeLine('system', `cwd: ${home}`),
        ])
      })
      .catch(() => {
        setLines((prev) => [
          ...prev,
          makeLine('stderr', 'could not reach context store — is rackstack running?'),
        ])
      })
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [lines])

  const append = useCallback((batch: TermLine[]) => {
    setLines((prev) => [...prev, ...batch].slice(-MAX_LINES))
  }, [])

  const clear = useCallback(() => {
    setLines([makeLine('system', 'cleared')])
  }, [])

  const run = useCallback(async (raw: string) => {
    const cmd = raw.trim()
    if (!cmd) return

    // Record in history
    setHistory((h) => [cmd, ...h.slice(0, 99)])
    setHistIdx(-1)

    // Always echo the command
    append([makeLine('cmd', `${cwd} $ ${cmd}`)])

    // Handle built-ins
    if (cmd === 'clear' || cmd === 'cls') {
      clear()
      return
    }

    // Handle cd client-side (the server has no persistent cwd)
    const cdArg = isCd(cmd)
    if (cdArg !== null) {
      let nextCwd = cdArg
      if (!nextCwd.startsWith('/')) {
        nextCwd = `${cwd}/${nextCwd}`
      }
      if (nextCwd === '~' || nextCwd === '') nextCwd = cwd  // fallback; server GET gives HOME
      // Ask server to resolve the path via a trivial pwd after cd
      try {
        setBusy(true)
        const res = await fetch(`${API}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: `cd ${cdArg} && pwd`, cwd }),
        })
        const data = await res.json() as { stdout: string; stderr: string; exitCode: number }
        if (data.exitCode === 0 && data.stdout) {
          const resolved = data.stdout.trim()
          setCwd(resolved)
          append([makeLine('system', `cwd → ${resolved}`)])
        } else if (data.stderr) {
          append([makeLine('stderr', data.stderr)])
        }
      } catch {
        append([makeLine('stderr', 'exec: network error')])
      } finally {
        setBusy(false)
      }
      return
    }

    // Regular command — POST to /exec
    try {
      setBusy(true)
      const res = await fetch(`${API}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd, cwd }),
      })
      const data = await res.json() as { stdout: string; stderr: string; exitCode: number }
      const batch: TermLine[] = []
      if (data.stdout) {
        for (const line of data.stdout.split('\n')) {
          batch.push(makeLine('stdout', line))
        }
      }
      if (data.stderr) {
        for (const line of data.stderr.split('\n')) {
          batch.push(makeLine('stderr', line))
        }
      }
      if (batch.length === 0) {
        batch.push(makeLine('system', `exit ${data.exitCode}`))
      }
      append(batch)
    } catch {
      append([makeLine('stderr', 'exec: network error')])
    } finally {
      setBusy(false)
    }
  }, [cwd, clear, append])

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input
      setInput('')
      void run(cmd)
      return
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      clear()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIdx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(nextIdx)
      setInput(history[nextIdx] ?? '')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx <= 0) {
        setHistIdx(-1)
        setInput('')
      } else {
        const nextIdx = histIdx - 1
        setHistIdx(nextIdx)
        setInput(history[nextIdx] ?? '')
      }
    }
  }, [input, run, clear, histIdx, history])

  const promptLabel = cwd ? `${cwd.split('/').pop() ?? cwd} $` : '$'

  return (
    <div className="term-panel" onClick={() => inputRef.current?.focus()}>
      <div className="term-panel__body">
        {lines.map((l) => (
          <div key={l.id} className={`term-line term-line--${l.kind}`}>
            {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="term-panel__footer">
        <span className="term-prompt">{promptLabel}</span>
        <input
          ref={inputRef}
          className="term-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="terminal input"
        />
        {busy && <span className="term-busy">▪▪▪</span>}
      </div>
    </div>
  )
}
