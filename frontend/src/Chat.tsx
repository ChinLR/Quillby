import { useEffect, useRef } from 'react'
import type { Message } from './api'
import { Avatar } from './Sprite'

type Sender = Message['sender']

// The backend labels our side "Counterbot (for Alex)"; on screen the wizard is Quillby.
const wizardName = (label: string) => label.replace(/^Counterbot/, 'Quillby')
const wizardText = (text: string) => text.replace(/Counterbot/g, 'Quillby')

const bubble: Record<Sender, string> = {
  customer_bot: 'bg-indigo-600 text-white',
  customer: 'bg-slate-800 text-white',
  company_bot: 'bg-white text-slate-800',
  human_agent: 'bg-emerald-100 text-emerald-950',
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
  // Who is "typing" right now (the three dots appear on that side). null/undefined = nobody.
  typing?: Pick<Message, 'sender' | 'sender_label'> | null
  empty: string
}) {
  const end = useRef<HTMLDivElement>(null)
  const typingKey = typing?.sender ?? ''
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, typingKey])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
      {messages.length === 0 && <p className="m-auto text-sm text-slate-400">{empty}</p>}
      {messages.map((m) => {
        if (m.sender === 'system')
          return (
            <p key={m.id} className="self-center rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">
              {wizardText(m.text)}
            </p>
          )
        const right = mine.includes(m.sender)
        return (
          <div key={m.id} className={`flex max-w-[88%] items-end gap-2 ${right ? 'flex-row-reverse self-end' : ''}`}>
            <Avatar who={m.sender} />
            <div className={`flex max-w-[80%] flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
              <span className="font-pixel px-1 text-[11px] text-slate-600">{wizardName(m.sender_label)}</span>
              {m.clicked_button ? (
                <span className="border-[3px] border-slate-900 bg-indigo-200 px-3 py-1 text-sm font-medium text-slate-900">▸ {m.clicked_button}</span>
              ) : (
                <div className={`border-[3px] border-slate-900 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${bubble[m.sender]}`}>{wizardText(m.text)}</div>
              )}
              {m.buttons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.buttons.map((b) => (
                    <span key={b} className="border-2 border-slate-900 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
      {typing && typing.sender !== 'system' && typing.sender !== 'customer' && (
        <div className={`flex items-end gap-2 ${mine.includes(typing.sender) ? 'flex-row-reverse self-end' : ''}`}>
          <Avatar who={typing.sender} />
          <div className={`flex flex-col gap-1 ${mine.includes(typing.sender) ? 'items-end' : 'items-start'}`}>
            <span className="font-pixel px-1 text-[11px] text-slate-600">{wizardName(typing.sender_label)} is typing</span>
            <div
              className={`flex gap-1.5 border-[3px] border-slate-900 px-3 py-3 ${mine.includes(typing.sender) ? 'bg-indigo-600' : 'bg-white'}`}
              aria-label={`${wizardName(typing.sender_label)} is typing`}
            >
              {[0, 150, 300].map((d) => (
                <span key={d} className={`size-2 animate-bounce ${mine.includes(typing.sender) ? 'bg-indigo-200' : 'bg-slate-500'}`} style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
