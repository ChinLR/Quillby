# Contract: Counterbot (frozen after commit; change only with a heads-up)

Source: `.plans/counterbot-spec.md`. Only what the demo script needs. No extra endpoints.

Conventions (from CLAUDE.md): snake_case JSON keys, ISO 8601 dates (UTC, e.g. `2026-10-17T10:30:00Z`), string ids, empty lists instead of null, Pydantic models with `response_model` on every endpoint. Errors: `HTTPException(status_code, detail="message")`; the frontend shows `detail`. Money is whole GBP integers.

There is one active negotiation at a time. Starting a new one replaces the old one. The human-agent window never needs an id: its endpoints work on the current negotiation.

## v2 changes (2026-10-17), all additive

1. Intake: `POST /api/intake` turns the customer's own words into the current case. Any complaint is accepted; the demo engine negotiates flight delays only (`supported: false` otherwise).
2. The chat no longer settles the claim. The human agent says they will call; the negotiation moves to a phone call answered by the ElevenLabs Counterbot voice agent (new statuses `awaiting_call`, `on_call`).
3. Call transcript lines arrive as normal `message` events with `channel: "call"`. Call progress arrives as a new `call` event.
4. Chat layout rule for every screen: Counterbot (`customer_bot`, `customer`) on the right, the company (`company_bot`, `human_agent`) on the left, `system` centred.
5. Show messages one at a time as they arrive (a typing indicator for `typing_ms` before each is fine). Never dump the history at once while a run is live.

## Pydantic models

```
Case
  id: str
  passenger_name: str
  booking_ref: str
  airline: str
  flight_number: str
  origin: str
  destination: str
  scheduled_arrival: str          # ISO
  actual_arrival: str             # ISO
  delay_minutes: int
  airline_reason: str             # what the airline claims, e.g. "operational reasons"
  goal_gbp: int                   # default 350
  floor_gbp: int                  # default 300
  legal: Legal
  complaint_type: str             # (v2) "flight_delay" for the demo; other values come from intake
  summary: str                    # (v2) the customer's problem in their own words ("" for the seeded case)

Legal
  title: str                      # e.g. "UK261 delay compensation (summary)"
  points: list[str]               # short bullets the bot may quote
  disclaimer: str                 # "Not legal advice."

Message
  id: str                         # "m1", "m2", ...
  sender: "customer_bot" | "company_bot" | "human_agent" | "customer" | "system"
  sender_label: str               # shown in the UI, e.g. "Northwind Assistant", "Sam (Northwind Support)"
  text: str
  buttons: list[str]              # quick-reply options offered by the company; [] if none
  clicked_button: str | None      # set when customer_bot picked a button
  typing_ms: int                  # how long the typing indicator ran before this message
  created_at: str                 # ISO
  channel: "chat" | "call"        # (v2) "call" = a line from the phone call transcript

Tactic
  stage: int                      # 1..6 (see ladder)
  stage_name: str                 # "Orient" | "State the claim" | "Reject the loop" | "Cite the rule" | "Pressure" | "Demand a human"
  move: str                       # click_button | state_claim | reject_loop | cite_rule | pressure | demand_human | hold_firm | counter | accept_offer | walk_away
  reason: str                     # one line shown on the board
  pressure: int                   # 0..100

Detection
  is_human: bool
  confidence: int                 # 0..100
  signals: list[str]              # e.g. ["slower reply", "not a canned phrase"]

Offer
  amount_gbp: int
  offer_type: "voucher" | "cash"
  accepted: bool                  # true on the final accepted offer

StatusUpdate
  status: "running" | "paused" | "awaiting_call" | "on_call" | "won" | "walked_away" | "failed"   # (v2) two call statuses
  human_reached: bool
  detail: str                     # "" if none

CallState                         # (v2)
  status: "waiting" | "in_progress" | "processing" | "done" | "failed"
  phone_number: str               # the number the agent must dial (Counterbot's line), "" if not configured
  conversation_id: str            # ElevenLabs conversation id, "" until the call is picked up
  duration_seconds: int
  detail: str                     # e.g. "Voice agent not configured", "" if none

EventEnvelope                     # exactly one of message/tactic/detection/offer/status/call is set, matching `type`
  seq: int                        # 1, 2, 3, ... per negotiation
  type: "message" | "tactic" | "detection" | "offer" | "status" | "call"   # (v2) "call"
  message: Message | None
  tactic: Tactic | None
  detection: Detection | None
  offer: Offer | None
  status: StatusUpdate | None
  call: CallState | None          # (v2)

NegotiationState
  id: str
  status: "running" | "paused" | "awaiting_call" | "on_call" | "won" | "walked_away" | "failed"
  human_reached: bool
  stage: int
  pressure: int
  best_offer_gbp: int | None
  goal_gbp: int
  floor_gbp: int
  started_at: str                 # ISO

Report
  outcome: "won" | "walked_away" | "failed"
  amount_gbp: int                 # 0 if not won
  offer_type: "voucher" | "cash" | "none"
  goal_gbp: int
  floor_gbp: int
  duration_seconds: int
  bot_message_count: int
  estimated_minutes_saved: int    # ESTIMATE: 2 minutes per message the bot sent. Label as an estimate in the UI.
  stages_reached: list[str]
  transcript: list[Message]       # chat and call lines, in order (see `channel`)
  resolved_on: "chat" | "call" | "none"   # (v2)
  call_duration_seconds: int      # (v2) 0 if there was no call

ConcessionStep                    # shown only in the human-agent window
  step: int
  offer_type: "voucher" | "cash" | "call"   # (v2) "call" = say you will phone instead
  amount_gbp: int                 # 0 for a "call" step
  condition: str                  # e.g. "Open with this", "Only if the bot cites the rule"
  channel: "chat" | "call"        # (v2) where this step happens

IntakeRequest                     # (v2)
  description: str                # the problem in the customer's own words (min 10 chars)
  goal_gbp: int | None            # optional; default comes from the case
  floor_gbp: int | None

IntakeResult                      # (v2)
  supported: bool                 # false if the demo can't negotiate this complaint type
  note: str                       # shown under the form, e.g. "Demo negotiates flight delays only"
  case: Case                      # the case built from the description (becomes the current case)
```

## Endpoints

### `GET /api/health`
`-> { ok: bool, replay_mode: bool }`
`replay_mode` is true when only cached LLM responses are served.

### `GET /api/case`
`-> Case` (the current case: the seeded demo case, or the last intake result)

### `POST /api/intake` (v2)
Body: `IntakeRequest`. `-> IntakeResult`. The LLM extracts the case from the description; missing facts fall back to the seeded demo case. The mock company is always the fictional Northwind Air, whatever company the customer names.
Errors: `422` if the description is too short or `floor_gbp > goal_gbp`.

### `POST /api/negotiations`
Start the autopilot on the current case. Replaces any existing negotiation.
Body: `{ goal_gbp: int, floor_gbp: int, speed: float }` (all optional; defaults: case goal, case floor, `1.0`; `speed` is a pacing multiplier from 0.5 to 3.0).
`-> NegotiationState`
Errors: `422` if `floor_gbp > goal_gbp`; `409` "This demo negotiates flight delays only" if the current case is not supported.

### `GET /api/negotiations/{id}`
`-> NegotiationState`. Errors: `404` "Negotiation not found".

### `GET /api/negotiations/{id}/events?after=<seq>`
Server-sent events. Content type `text/event-stream`. Each SSE event has `id: <seq>` and `data: <EventEnvelope as JSON>` (default event name, so `EventSource.onmessage` works). The server first sends every event with `seq > after` (default 0, so a refresh gets the full history), then streams new ones. The stream stays open after the negotiation ends. Errors: `404`.

### `GET /api/negotiations/{id}/history?after=<seq>`
Same events as a plain JSON list. This is the polling fallback if SSE misbehaves, and it also gives the frontend generated types for the event shapes.
`-> { events: list[EventEnvelope], last_seq: int }`. Errors: `404`.

### `POST /api/negotiations/{id}/pause` and `POST /api/negotiations/{id}/resume`
`-> NegotiationState`. Errors: `404`; `409` if the negotiation has already finished, or is in the call phase (`awaiting_call`, `on_call`).

### `GET /api/negotiations/{id}/call` (v2)
`-> CallState`. Errors: `404`; `409` "No call yet" before the agent asks to call.

### `POST /api/negotiations/{id}/call/outcome` (v2)
Manual fallback if the call transcript can't be read. Body: `{ amount_gbp: int, offer_type: "cash" | "voucher" | "none" }` (`none` = no deal).
`-> NegotiationState` (now `won` or `walked_away`). Errors: `404`; `409` if not in the call phase.

### `POST /api/negotiations/{id}/message`
Customer takeover message while paused. Body: `{ text: str }`.
`-> Message` (sender `customer`). Errors: `404`; `409` "Pause the negotiation first".

### `GET /api/negotiations/{id}/report`
`-> Report`. Errors: `404`; `409` "Negotiation not finished".

### `POST /api/reset`
Clears the current negotiation and the agent inbox, and restores the seeded demo case. Does not delete the LLM cache.
`-> { ok: bool }`

### Human-agent window (current negotiation, no id)

`GET /api/company/inbox`
`-> { handed_off: bool, auto_agent: bool, messages: list[Message], cheat_sheet: list[ConcessionStep], call_number: str }`
The frontend polls this every second. `messages` is the full chat so far. `handed_off` is false until the mock bot hands over. (v2) `call_number` is "" until the agent asks to call, then it is the number to dial (show it big). Errors: `404` "No active negotiation".

`POST /api/company/reply`
Body: `{ text: str }`. `-> Message` (sender `human_agent`). Errors: `404`; `409` "Not handed off yet".
The backend reads the amount and type from the text (see LLM schemas). The agent never types structured data.

`POST /api/company/auto-agent`
Body: `{ enabled: bool }`. `-> { auto_agent: bool }`. Turns the scripted fallback agent on or off. Errors: `404`.

## Event order for the demo path (v2)

1. `status` running
2. alternating `message` (company_bot / customer_bot), each customer_bot move preceded by a `tactic`
3. `detection` events once the bot starts checking for a human
4. `status` with `human_reached: true`, then `message` events with sender `human_agent`
5. `offer` events as the agent concedes in chat (voucher, then a low cash offer)
6. the agent says they will call: `tactic` move `accept_call`, a customer_bot message giving the number, `status` awaiting_call, `call` (status waiting, phone_number set)
7. the agent dials the number; the voice agent answers: `status` on_call, `call` (in_progress)
8. `message` events with `channel: "call"` as the transcript arrives (customer_bot = Counterbot's voice, human_agent = the caller); they may arrive in batches
9. call ends: `call` (processing, then done), `offer` events read from the transcript, final `offer` (`accepted: true`) and `status` won, or `status` walked_away if no deal

## Mock company bot rules (backend, deterministic)

The mock bot hands over to the human agent only when all are true:
- the customer bot has rejected the loop at least 2 times,
- the customer bot has cited the regulation at least once,
- the customer bot has asked for a human at least 2 times.

Then it says it is connecting a colleague and `handed_off` becomes true. Thresholds live in `backend/seed/company_bot.json`.

## LLM output schemas (small and flat)

```
TacticStep:   { "stage": 1, "move": "string", "reason": "string", "message": "string", "clicked_button": "string" }
              # clicked_button is "" if no button is clicked
DetectionResult: { "is_human": true, "confidence": 0, "signals": ["string"] }
OfferParse:   { "offer_gbp": 0, "offer_type": "voucher|cash|none", "accepts_claim": false }
```

Each is validated with Pydantic, retried once, then replaced with a canned line from `backend/seed/company_bot.json` (`fallback_lines`). An LLM failure never fails the negotiation run. The negotiator decides from the structured `Message` text, buttons and timing, not from the `sender` field.

## Seed data shapes (`backend/seed/`)

- `case.json`: one `Case` object (including `legal`). Hero case: Li Ren, `NW4821`, Northwind Air, Edinburgh to Faro, 235 minutes late, reason "operational reasons", goal 350, floor 300. The UK261 points must be verified against the official text before the demo.
- `company_bot.json`: `{ nodes: [ { id, text, buttons: [ { label, next } ] } ], canned_phrases: [str], loop_replies: [str], handoff: { min_loop_rejections, min_rule_citations, min_human_requests }, fallback_lines: [str], handoff_message: str }`
- `concession_ladder.json`: `list[ConcessionStep]`. (v2) Chat: step 1 voucher 75, step 2 cash 150, step 3 "call" (say you'll phone to sort it out). Call: step 4 cash 300, step 5 cash 350 (only if Counterbot holds firm).
- `scripted_agent.json`: `{ lines: [ { step, text } ] }` for the fallback agent (chat steps only; the call is always live).

## Frontend routes

- `/` dashboard: (v2) intake screen first (problem in your own words, goal, minimum; prefilled with the demo case), then case summary, chat, tactic board (stage, reason, pressure meter, detection confidence), Start / Pause / Take over / Reset, (v2) call panel (waiting for call with the number, live call with timer and transcript lines, then result), outcome report on completion.
- `#/agent`: the human-agent window (inbox, reply box, cheat sheet, auto-agent toggle, (v2) the number to dial once the call is requested).

## Demo path (what must work end to end) (v2)

1. The customer types the problem; `POST /api/intake` builds the case; they confirm it.
2. `POST /api/negotiations` starts the run; the dashboard connects to `GET /api/negotiations/{id}/events`.
3. The bot works the menu, rejects the loop, states the claim, cites the rule, and demands a human; pressure climbs.
4. The mock hands over; `status` fires with `human_reached: true`.
5. In `#/agent`, `GET /api/company/inbox` shows `handed_off: true`; the teammate replies via `POST /api/company/reply` (or the scripted agent runs).
6. The bot rejects the voucher and the 150. The agent says they'll call; the dashboard shows the number.
7. The teammate dials it on speaker; Counterbot's voice answers and negotiates; the call transcript appears; the outcome lands.
8. `GET /api/negotiations/{id}/report` returns the outcome (`resolved_on: "call"`).

Fallbacks: no voice agent configured or the call fails, use `POST .../call/outcome`; LLM down, templates; everything down, `ENGINE=stub`.

## smoke.sh (draft, in order)

```
curl -sf $B/api/health
curl -sf $B/api/case | head -c 200
ID=$(curl -sf -X POST $B/api/negotiations -H 'Content-Type: application/json' -d '{"speed":3.0}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -sf $B/api/negotiations/$ID | head -c 200
curl -sf "$B/api/negotiations/$ID/history" | head -c 200
curl -sf $B/api/company/inbox | head -c 200
```

## Voice agent (backend only, v2)

The ElevenLabs Counterbot agent answers calls to its Twilio number. Before each call the backend loads the current case, the chat so far and the negotiating rules into the agent's prompt. The backend polls ElevenLabs for the conversation and its transcript; the frontend never talks to ElevenLabs or Twilio.

## Change rule

A contract change means: update this file, run `npm run types`, tell the other person before pushing.
