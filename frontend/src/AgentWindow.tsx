import { useEffect, useState } from 'react'
import { getInbox, sendAgentReply, setAutoAgent } from './api'
import type { Inbox } from './api'
import { Chat } from './Chat'
import { ConcessionLadder } from './ConcessionLadder'

export function AgentWindow() {
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [idle, setIdle] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const tick = async () => {
      try {
        setInbox(await getInbox())
        setIdle(false)
      } catch {
        setInbox(null)
        setIdle(true)
      }
      if (!stopped) timer = window.setTimeout(tick, 1000)
    }
    tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      setInbox(await getInbox())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const reply = () =>
    run(async () => {
      if (!draft.trim()) return
      await sendAgentReply(draft.trim())
      setDraft('')
    })

  const handedOff = (inbox?.handed_off ?? false) && !inbox?.call_number

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 text-zinc-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-300 bg-white px-6 py-3">
        <h1 className="font-semibold">Northwind Air · Agent console</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${handedOff ? 'bg-emerald-100 text-emerald-800' : idle ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-100 text-amber-800'}`}
        >
          {inbox?.call_number ? 'Call the number below' : handedOff ? 'Chat assigned to you' : idle ? 'No active chat' : 'Bot is handling the chat'}
        </span>
        {inbox && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
            <span className="text-zinc-600">Auto-agent</span>
            <button
              role="switch"
              aria-checked={inbox.auto_agent}
              disabled={busy}
              onClick={() => run(() => setAutoAgent(!inbox.auto_agent))}
              className={`relative h-6 w-11 rounded-full transition-colors ${inbox.auto_agent ? 'bg-emerald-500' : 'bg-zinc-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${inbox.auto_agent ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_300px] md:p-6">
        <section className="flex h-[calc(100vh-7rem)] min-h-[420px] flex-col overflow-hidden rounded-xl bg-white ring-1 ring-zinc-300">
          <div className="min-h-0 flex-1">
            <Chat
              messages={inbox?.messages ?? []}
              mine={['customer_bot', 'customer']}
              empty={idle ? 'Waiting for a customer. Start a run on the dashboard.' : 'Loading chat…'}
            />
          </div>
          {inbox?.call_number && (
            <div className="border-t border-emerald-300 bg-emerald-600 px-4 py-4 text-center text-white">
              <p className="text-sm font-medium">Call this number now (on speaker)</p>
              <p className="text-4xl font-bold tracking-wide tabular-nums">{inbox.call_number}</p>
            </div>
          )}
          {error && <p className="bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              reply()
            }}
            className="flex gap-2 border-t border-zinc-200 p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!handedOff}
              placeholder={handedOff ? (inbox?.auto_agent ? 'Type to take over from auto-agent…' : 'Reply as Sam…') : 'You can reply once the bot hands over'}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none disabled:bg-zinc-50"
            />
            <button disabled={!handedOff || busy || !draft.trim()} className="px-btn font-pixel bg-amber-300 px-4 py-2 text-sm text-slate-900 uppercase disabled:opacity-40">
              Send
            </button>
          </form>
        </section>

        <aside className="flex h-fit flex-col gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Concession ladder</h2>
            <p className="text-xs text-amber-800/70">Agent eyes only. Free wording, amounts in order.</p>
          </div>
          <ConcessionLadder steps={inbox?.cheat_sheet ?? []} offers={[]} />
          {!inbox && <p className="text-xs text-amber-800/70">Appears when a chat is active.</p>}
        </aside>
      </main>
    </div>
  )
}
