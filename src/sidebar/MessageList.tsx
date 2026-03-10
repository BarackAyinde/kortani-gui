import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import MessageBubble from './MessageBubble'

export default function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Track whether user has scrolled up to read history
  const userScrolledUp = useRef(false)

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledUp.current = !atBottom
  }

  useEffect(() => {
    if (userScrolledUp.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
  }, [messages])

  return (
    <div ref={listRef} className="message-list" onScroll={handleScroll}>

      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty__wordmark">KORTANA</div>
          <p className="chat-empty__heading">What can I help with?</p>
          <p className="chat-empty__sub">Context, intelligence, and execution — in one thread.</p>
        </div>
      ) : (
        messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming}
            isLast={i === messages.length - 1}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
