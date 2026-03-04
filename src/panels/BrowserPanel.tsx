import { useRef, useState } from 'react'

const DEFAULT_URL = 'about:blank'

export default function BrowserPanel() {
  const [input, setInput] = useState('http://localhost:5173')
  const [url, setUrl] = useState(DEFAULT_URL)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const navigate = (target: string) => {
    setUrl(target)
  }

  const handleGo = () => {
    navigate(input.trim() || DEFAULT_URL)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleGo()
  }

  return (
    <div className="browser-panel">
      <div className="browser-panel__bar">
        <input
          className="browser-panel__url"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label="URL"
        />
        <button className="browser-panel__go" onClick={handleGo}>Go</button>
      </div>
      <iframe
        ref={iframeRef}
        className="browser-panel__iframe"
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms"
        title="Browser"
      />
    </div>
  )
}
