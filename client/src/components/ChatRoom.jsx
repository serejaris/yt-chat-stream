import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Message from './Message'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin

function ChatRoom({ userName, onLeave }) {
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [input, setInput] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', userName)
    })

    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })

    socket.on('users', (userList) => {
      setUsers(userList)
    })

    socket.on('typing', ({ name }) => {
      setTypingUsers((prev) => {
        if (prev.includes(name)) return prev
        return [...prev, name]
      })
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== name))
      }, 2000)
    })

    return () => {
      socket.disconnect()
    }
  }, [userName])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !socketRef.current) return
    socketRef.current.emit('message', text)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
      return
    }
    if (socketRef.current) {
      clearTimeout(typingTimeoutRef.current)
      socketRef.current.emit('typing')
      typingTimeoutRef.current = setTimeout(() => {}, 1000)
    }
  }

  const typingText =
    typingUsers.length > 0
      ? typingUsers.length === 1
        ? `${typingUsers[0]} is typing...`
        : `${typingUsers.join(', ')} are typing...`
      : ''

  return (
    <div className="chat-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Online</h2>
          <span className="user-count">{users.length}</span>
        </div>
        <div className="user-list">
          {users.map((user) => (
            <div key={user} className="user-item">
              <span className="online-dot" />
              <span>{user}</span>
            </div>
          ))}
        </div>
        <button className="leave-btn" onClick={onLeave}>
          Leave Chat
        </button>
      </aside>

      <main className="chat-main">
        <div className="messages-area">
          {messages.map((msg, i) => (
            <Message key={i} message={msg} isOwn={msg.name === userName} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="typing-indicator">{typingText}</div>
        <div className="input-area">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </main>
    </div>
  )
}

export default ChatRoom
