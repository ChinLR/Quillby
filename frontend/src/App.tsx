import { useEffect, useState } from 'react'
import { AgentWindow } from './AgentWindow'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'
import type { Claim } from './Landing'
import { Review } from './Review'

// Routes: '' = landing, '#/review' = findings, '#/run' = dashboard, '#/agent' = second-laptop agent window.
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

  const go = (to: string) => {
    window.location.hash = to
  }

  if (hash === '#/agent') return <AgentWindow />
  if (hash === '#/run')
    return (
      <Dashboard
        claim={claim}
        autoStart={autoStart}
        onStarted={() => setAutoStart(false)}
        onNewClaim={() => {
          setClaim(null)
          go('')
        }}
      />
    )
  // The findings page needs a claim; a refresh loses it, so send people back to the start.
  if (hash === '#/review' && claim)
    return (
      <Review
        claim={claim}
        onBack={() => go('')}
        onStart={() => {
          setAutoStart(true)
          go('#/run')
        }}
      />
    )
  return (
    <Landing
      onReview={(c) => {
        setClaim(c)
        go('#/review')
      }}
    />
  )
}
