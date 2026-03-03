import { useUIStore } from '../store/uiStore'

export default function ChatSidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside className="chat-sidebar" data-open={sidebarOpen}>
      <div className="chat-sidebar__inner">
        <span className="chat-sidebar__label">CHAT</span>
      </div>
    </aside>
  )
}
