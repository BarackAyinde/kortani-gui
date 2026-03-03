import CanvasZone from './canvas/CanvasZone'
import ChatSidebar from './sidebar/ChatSidebar'
import { useUIStore } from './store/uiStore'

export default function App() {
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <div className="app-shell">
      {/* Placeholder top bar — replaced in S-04 */}
      <div className="top-bar-placeholder">
        <span className="top-bar-placeholder__label">KORTANA — S-03</span>
        <button className="top-bar-placeholder__toggle" onClick={toggleSidebar}>
          {sidebarOpen ? 'hide sidebar' : 'show sidebar'}
        </button>
      </div>

      <div className="workspace">
        <CanvasZone />
        <ChatSidebar />
      </div>
    </div>
  )
}
