import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev-only feedback toolbar; the dynamic import keeps it out of production builds.
const Agentation = import.meta.env.DEV ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation }))) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {Agentation && (
      <Suspense>
        <Agentation endpoint="http://localhost:4747" />
      </Suspense>
    )}
  </StrictMode>,
)
