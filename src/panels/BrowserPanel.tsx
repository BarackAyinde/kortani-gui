import { useEffect, useRef, useState } from 'react'
import { useBrowserStore } from '../store/browserStore'

const DEFAULT_URL = 'about:blank'

export default function BrowserPanel() {
  const { currentUrl, kortanaDriving, clearKortanaDriving } = useBrowserStore()
  const [input, setInput] = useState('https://')
  const [url, setUrl] = useState(DEFAULT_URL)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Sync when Kortana navigates via browserStore
  useEffect(() => {
    if (kortanaDriving && currentUrl !== DEFAULT_URL) {
      setUrl(currentUrl)
      setInput(currentUrl)
      clearKortanaDriving()
    }
  }, [currentUrl, kortanaDriving, clearKortanaDriving])

  const navigate = (target: string) => {
    const trimmed = target.trim()
    if (!trimmed) return
    // Prepend https:// if no scheme
    const finalUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed === DEFAULT_URL
        ? trimmed
        : `https://${trimmed}`
    setUrl(finalUrl)
    setInput(finalUrl)
  }

  const handleGo = () => navigate(input)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleGo()
  }

  return (
    <div className="browser-panel">
      <div className="browser-panel__bar">
        {kortanaDriving && (
          <span className="browser-panel__kortana-tag" title="Kortana is browsing">K</span>
        )}
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
