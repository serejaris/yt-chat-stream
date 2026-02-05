import { useState } from 'react'
import NameEntry from './components/NameEntry'
import ChatRoom from './components/ChatRoom'

function App() {
  const [userName, setUserName] = useState(null)

  if (!userName) {
    return <NameEntry onJoin={setUserName} />
  }

  return <ChatRoom userName={userName} onLeave={() => setUserName(null)} />
}

export default App
