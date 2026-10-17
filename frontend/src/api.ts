import type { components } from './api-types'
import { friendlyError } from './copy'

type S = components['schemas']
export type Case = S['Case']
export type Message = S['Message']
export type Tactic = S['Tactic']
export type Detection = S['Detection']
export type Offer = S['Offer']
export type StatusUpdate = S['StatusUpdate']
export type EventEnvelope = S['EventEnvelope']
export type NegotiationState = S['NegotiationState']
export type Report = S['Report']
export type Inbox = S['Inbox']
export type ConcessionStep = S['ConcessionStep']
export type StartRequest = S['StartRequest']
export type CallState = S['CallState']
export type IntakeResult = S['IntakeResult']
export type IntakeRequest = S['IntakeRequest']

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof err.detail === 'string' ? friendlyError(err.detail) : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const getHealth = () => api<S['HealthResponse']>('/health')
export const getCase = () => api<Case>('/case')
export const startNegotiation = (body: StartRequest) => api<NegotiationState>('/negotiations', body)
export const getNegotiation = (id: string) => api<NegotiationState>(`/negotiations/${id}`)
export const getHistory =(id: string, after: number) =>
  api<S['History']>(`/negotiations/${id}/history?after=${after}`)
export const pauseNegotiation = (id: string) => api<NegotiationState>(`/negotiations/${id}/pause`, {})
export const resumeNegotiation = (id: string) => api<NegotiationState>(`/negotiations/${id}/resume`, {})
export const sendTakeover = (id: string, text: string) => api<Message>(`/negotiations/${id}/message`, { text })
export const getReport = (id: string) => api<Report>(`/negotiations/${id}/report`)
export const resetDemo = () => api<S['OkResponse']>('/reset', {})
export const eventsUrl = (id: string) => `/api/negotiations/${id}/events`

export const getInbox = () => api<Inbox>('/company/inbox')
export const sendAgentReply = (text: string) => api<Message>('/company/reply', { text })
export const setAutoAgent = (enabled: boolean) => api<S['AutoAgentResponse']>('/company/auto-agent', { enabled })

export const submitIntake = (body: IntakeRequest) => api<IntakeResult>('/intake', body)
export const getCall = (id: string) => api<CallState>(`/negotiations/${id}/call`)
export const recordCallOutcome = (id: string, amount_gbp: number, offer_type: 'cash' | 'voucher' | 'none') =>
  api<NegotiationState>(`/negotiations/${id}/call/outcome`, { amount_gbp, offer_type })
