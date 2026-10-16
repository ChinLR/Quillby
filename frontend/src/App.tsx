import { useEffect, useState } from 'react'
import { api } from './api'

export default function App() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    api<{ ok: boolean }>('/health').then((r) => setOk(r.ok)).catch(() => setOk(false))
  }, [])
  return (
    <div className="p-8 text-xl">
      Backend health: {ok === null ? '...' : ok ? 'OK' : 'DOWN'}
    </div>
  )
}
