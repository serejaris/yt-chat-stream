function Message({ message, isOwn }) {
  if (message.type === 'system') {
    return (
      <div className="message-system">
        <span>{message.text}</span>
      </div>
    )
  }

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`message ${isOwn ? 'own' : 'other'}`}>
      {!isOwn && (
        <span className="message-name">
          {message.name}
          {message.isMod && <span className="mod-badge-inline">MOD</span>}
        </span>
      )}
      <div className="message-bubble">{message.text}</div>
      <span className="message-time">{time}</span>
    </div>
  )
}

export default Message
