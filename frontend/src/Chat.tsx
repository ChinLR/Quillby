import { useEffect, useRef } from 'react'
import type { Message } from './api'

type Sender = Message['sender']

const bubble: Record<Sender, string> = {
  customer_bot: 'bg-indigo-600 text-white',
  customer: 'bg-slate-800 text-white',
  company_bot: 'bg-white text-slate-800 ring-1 ring-slate-200',
  human_agent: 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300',
  system: '',
}

export function Chat({
  messages,
  mine,
  typing,
  empty,
}: {
  messages: Message[]
  mine: Sender[]
  typing?: boolean
  empty: string
}) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, typing])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
      {messages.length === 0 && <p className="m-auto text-sm text-slate-400">{empty}</p>}
      {messages.map((m) => {
        if (m.sender === 'system')
          return (
            <p key={m.id} className="self-center rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">
              {m.text}
            </p>
          )
        const right = mine.includes(m.sender)
        return (
          <div key={m.id} className={`flex max-w-[80%] flex-col gap-1 ${right ? 'items-end self-end' : 'items-start'}`}>
            <span className="px-1 text-xs font-medium text-slate-500">{m.sender_label}</span>
            {m.clicked_button ? (
              <span className="rounded-full border-2 border-indigo-600 bg-white px-3 py-1 text-sm font-medium text-indigo-700">
                ▸ {m.clicked_button}
              </span>
            ) : (
              <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${bubble[m.sender]}`}>
                {m.text}
              </div>
            )}
            {m.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.buttons.map((b) => (
                  <span key={b} className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-600">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {typing && (
        <div className="flex gap-1 self-start rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200" aria-label="Typing">
          {[0, 150, 300].map((d) => (
            <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
