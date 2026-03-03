import { useUIStore } from '../store/uiStore'
import MessageList from './MessageList'

export default function ChatSidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside className="chat-sidebar" data-open={sidebarOpen}>
      <div className="chat-sidebar__inner">
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">CHAT</span>
        </div>
        <MessageList />
        {/* Input mounts here in S-06 */}
      </div>
    </aside>
  )
}
