import MessageList from '../sidebar/MessageList'
import MessageInput from '../sidebar/MessageInput'

export default function ChatPanel() {
  return (
    <div className="chat-panel">
      <MessageList />
      <MessageInput />
    </div>
  )
}
