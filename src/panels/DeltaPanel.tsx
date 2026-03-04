import { useState } from 'react'

interface DeltaFile {
  path: string
  status: 'modified' | 'added' | 'deleted'
  diff: string
  added: number
  removed: number
}

interface DeltaPayload {
  files: DeltaFile[]
  summary: string
}

// Exported so the chat integration can push deltas to this panel later
let pendingDelta: DeltaPayload | null = null
export function setPendingDelta(d: DeltaPayload) { pendingDelta = d }

function countDiffLines(diff: string): { added: number; removed: number } {
  const lines = diff.split('\n')
  return {
    added:   lines.filter((l) => l.startsWith('+')).length,
    removed: lines.filter((l) => l.startsWith('-')).length,
  }
}

export default function DeltaPanel() {
  const [delta] = useState<DeltaPayload | null>(pendingDelta)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set())

  if (!delta || delta.files.length === 0) {
    return (
      <div className="delta-panel delta-panel--empty">
        <div className="delta-empty">
          <span className="delta-empty__icon">◈</span>
          <span className="delta-empty__label">No delta</span>
          <span className="delta-empty__sub">
            Kortana will populate this panel when proposing code changes.
          </span>
        </div>
      </div>
    )
  }

  const file = delta.files[selectedIdx]!
  const { added, removed } = countDiffLines(file.diff)
  const approved = approvedIds.has(selectedIdx)

  const approve = () => setApprovedIds((s) => new Set(s).add(selectedIdx))

  const diffLines = file.diff.split('\n').filter(Boolean)

  return (
    <div className="delta-panel">
      {/* File list */}
      <div className="delta-panel__files">
        <div className="delta-panel__summary">
          DELTA — {delta.files.length} file{delta.files.length !== 1 ? 's' : ''} changed
        </div>
        {delta.files.map((f, i) => {
          const counts = countDiffLines(f.diff)
          return (
            <div
              key={f.path}
              className={`delta-file${i === selectedIdx ? ' delta-file--active' : ''}`}
              onClick={() => setSelectedIdx(i)}
            >
              <span className="delta-file__path">{f.path}</span>
              <span className={`delta-file__status delta-file__status--${f.status}`}>
                [{f.status}]
              </span>
              <span className="delta-file__counts">
                <span className="delta-count--add">+{counts.added}</span>
                {' '}
                <span className="delta-count--rem">-{counts.removed}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Diff view */}
      <div className="delta-panel__diff">
        <div className="delta-diff__header">
          <span className="delta-diff__filename">{file.path}</span>
          <span className="delta-diff__counts">
            <span className="delta-count--add">+{added}</span>{' '}
            <span className="delta-count--rem">-{removed}</span>
          </span>
          {approved && <span className="delta-diff__approved">✓ approved</span>}
        </div>
        <div className="delta-diff__body">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+')
                  ? 'diff-line diff-line--add'
                  : line.startsWith('-')
                  ? 'diff-line diff-line--rem'
                  : line.startsWith('@@')
                  ? 'diff-line diff-line--hunk'
                  : 'diff-line'
              }
            >
              {line}
            </div>
          ))}
        </div>
        {!approved && (
          <div className="delta-diff__actions">
            <button className="delta-btn delta-btn--approve" onClick={approve}>
              Approve Change
            </button>
            <button className="delta-btn delta-btn--revision">
              Request Revision
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
