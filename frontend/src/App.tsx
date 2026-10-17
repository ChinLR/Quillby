import { useEffect, useState } from 'react'
import { AgentWindow } from './AgentWindow'
import { Companion } from './Companion'
import { Dashboard } from './Dashboard'
import { Home } from './Home'
import { Landing } from './Landing'
import type { Claim } from './Landing'
import { Review } from './Review'
import { Scenery } from './Scenery'

// Routes: '' = marketing home, '#/start' = intake form, '#/review' = findings, '#/run' = dashboard, '#/agent' = second-laptop agent window.
function Routes() {
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
          go('#/start')
        }}
      />
    )
  // The findings page needs a claim; a refresh loses it, so send people back to the start.
  if (hash === '#/review' && claim)
    return (
      <Review
        claim={claim}
        onBack={() => go('#/start')}
        onStart={(checkIns) => {
          setClaim({ ...claim, checkIns })
          setAutoStart(true)
          go('#/run')
        }}
      />
    )
  if (hash !== '#/start') return <Home />
  return (
    <Landing
      onReview={(c) => {
        setClaim(c)
        go('#/review')
      }}
    />
  )
}

export default function App() {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return (
    <>
      <Scenery />
      <Routes />
      {window.location.hash !== '#/agent' && <Companion />}
    </>
  )
}
