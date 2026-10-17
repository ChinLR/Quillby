import { useEffect, useState } from 'react'
import { AgentWindow } from './AgentWindow'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'
import type { Claim } from './Landing'

// Routes: '' = landing (intake), '#/run' = dashboard, '#/agent' = second-laptop agent window.
export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  const [claim, setClaim] = useState<Claim | null>(null)
  const [autoStart, setAutoStart] = useState(false)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    document.title = hash === '#/agent' ? 'Agent console · Counterbot' : 'Counterbot'
  }, [hash])

  if (hash === '#/agent') return <AgentWindow />
  if (hash === '#/run')
    return (
      <Dashboard
        claim={claim}
        autoStart={autoStart}
        onStarted={() => setAutoStart(false)}
        onNewClaim={() => {
          setClaim(null)
          window.location.hash = ''
        }}
      />
    )
  return (
    <Landing
      onStart={(c) => {
        setClaim(c)
        setAutoStart(true)
        window.location.hash = '#/run'
      }}
    />
  )
}
