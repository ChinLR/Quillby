import { useEffect, useState } from 'react'
import { AgentWindow } from './AgentWindow'
import { Dashboard } from './Dashboard'

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    document.title = hash === '#/agent' ? 'Agent console · Counterbot' : 'Counterbot'
  }, [hash])
  return hash === '#/agent' ? <AgentWindow /> : <Dashboard />
}
