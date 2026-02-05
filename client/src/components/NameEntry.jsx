import { useState } from 'react'

function NameEntry({ onJoin }) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      onJoin(trimmed)
    }
  }

  const isValid = name.trim().length >= 2 && name.trim().length <= 20

  return (
    <div className="name-entry">
      <form className="name-entry-card" onSubmit={handleSubmit}>
        <h1>Join Chat</h1>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button type="submit" disabled={!isValid}>
          Enter
        </button>
      </form>
    </div>
  )
}

export default NameEntry
