# Contract: Counterbot (frozen after commit; change only with a heads-up)

Source: `.plans/counterbot-spec.md`. Only what the demo script needs. No extra endpoints.

Conventions (from CLAUDE.md): snake_case JSON keys, ISO 8601 dates (UTC, e.g. `2026-10-17T10:30:00Z`), string ids, empty lists instead of null, Pydantic models with `response_model` on every endpoint. Errors: `HTTPException(status_code, detail="message")`; the frontend shows `detail`. Money is whole GBP integers.

There is one active negotiation at a time. Starting a new one replaces the old one. The human-agent window never needs an id: its endpoints work on the current negotiation.

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
  status: "running" | "paused" | "won" | "walked_away" | "failed"
  human_reached: bool
  detail: str                     # "" if none

EventEnvelope                     # exactly one of message/tactic/detection/offer/status is set, matching `type`
  seq: int                        # 1, 2, 3, ... per negotiation
  type: "message" | "tactic" | "detection" | "offer" | "status"
  message: Message | None
  tactic: Tactic | None
  detection: Detection | None
  offer: Offer | None
  status: StatusUpdate | None

NegotiationState
  id: str
  status: "running" | "paused" | "won" | "walked_away" | "failed"
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
  transcript: list[Message]

ConcessionStep                    # shown only in the human-agent window
  step: int
  offer_type: "voucher" | "cash"
  amount_gbp: int
  condition: str                  # e.g. "Open with this", "Only if the bot cites the rule"
```

## Endpoints

### `GET /api/health`
`-> { ok: bool, replay_mode: bool }`
`replay_mode` is true when only cached LLM responses are served.

### `GET /api/case`
`-> Case`

### `POST /api/negotiations`
Start the autopilot. Replaces any existing negotiation.
Body: `{ goal_gbp: int, floor_gbp: int, speed: float }` (all optional; defaults: case goal, case floor, `1.0`; `speed` is a pacing multiplier from 0.5 to 3.0).
`-> NegotiationState`
Errors: `422` if `floor_gbp > goal_gbp`.

### `GET /api/negotiations/{id}`
`-> NegotiationState`. Errors: `404` "Negotiation not found".

### `GET /api/negotiations/{id}/events?after=<seq>`
Server-sent events. Content type `text/event-stream`. Each SSE event has `id: <seq>` and `data: <EventEnvelope as JSON>` (default event name, so `EventSource.onmessage` works). The server first sends every event with `seq > after` (default 0, so a refresh gets the full history), then streams new ones. The stream stays open after the negotiation ends. Errors: `404`.

### `GET /api/negotiations/{id}/history?after=<seq>`
Same events as a plain JSON list. This is the polling fallback if SSE misbehaves, and it also gives the frontend generated types for the event shapes.
`-> { events: list[EventEnvelope], last_seq: int }`. Errors: `404`.

### `POST /api/negotiations/{id}/pause` and `POST /api/negotiations/{id}/resume`
`-> NegotiationState`. Errors: `404`; `409` if the negotiation has already finished.

### `POST /api/negotiations/{id}/message`
Customer takeover message while paused. Body: `{ text: str }`.
`-> Message` (sender `customer`). Errors: `404`; `409` "Pause the negotiation first".

### `GET /api/negotiations/{id}/report`
`-> Report`. Errors: `404`; `409` "Negotiation not finished".

### `POST /api/reset`
Clears the current negotiation and the agent inbox. Does not delete the LLM cache.
`-> { ok: bool }`

### Human-agent window (current negotiation, no id)

`GET /api/company/inbox`
`-> { handed_off: bool, auto_agent: bool, messages: list[Message], cheat_sheet: list[ConcessionStep] }`
The frontend polls this every second. `messages` is the full chat so far. `handed_off` is false until the mock bot hands over. Errors: `404` "No active negotiation".

`POST /api/company/reply`
Body: `{ text: str }`. `-> Message` (sender `human_agent`). Errors: `404`; `409` "Not handed off yet".
The backend reads the amount and type from the text (see LLM schemas). The agent never types structured data.

`POST /api/company/auto-agent`
Body: `{ enabled: bool }`. `-> { auto_agent: bool }`. Turns the scripted fallback agent on or off. Errors: `404`.

## Event order for the demo path

1. `status` running
2. alternating `message` (company_bot / customer_bot), each customer_bot move preceded by a `tactic`
3. `detection` events once the bot starts checking for a human
4. `status` with `human_reached: true`, then `message` events with sender `human_agent`
5. `offer` events as the agent concedes
6. final `offer` (`accepted: true`) and `status` won

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

- `case.json`: one `Case` object (including `legal`). Hero case: Alex Morgan, `NW4821`, Northwind Air, Edinburgh to Faro, 235 minutes late, reason "operational reasons", goal 350, floor 300. The UK261 points must be verified against the official text before the demo.
- `company_bot.json`: `{ nodes: [ { id, text, buttons: [ { label, next } ] } ], canned_phrases: [str], loop_replies: [str], handoff: { min_loop_rejections, min_rule_citations, min_human_requests }, fallback_lines: [str], handoff_message: str }`
- `concession_ladder.json`: `list[ConcessionStep]`. Defaults: step 1 voucher 75, step 2 cash 150, step 3 cash 300, step 4 cash 350 (only if the bot holds firm and refutes "operational reasons").
- `scripted_agent.json`: `{ lines: [ { step, text } ] }` for the fallback agent.

## Frontend routes

- `/` dashboard: case summary, chat, tactic board (stage, reason, pressure meter, detection confidence), Start / Pause / Take over / Reset, outcome report on completion.
- `#/agent`: the human-agent window (inbox, reply box, cheat sheet, auto-agent toggle).

## Demo path (what must work end to end)

1. `GET /api/case` shows the hero case.
2. `POST /api/negotiations` starts the run; the dashboard connects to `GET /api/negotiations/{id}/events`.
3. The bot works the menu, rejects the loop, states the claim, cites the rule, and demands a human; pressure climbs.
4. The mock hands over; `status` fires with `human_reached: true`.
5. In `#/agent`, `GET /api/company/inbox` shows `handed_off: true`; the teammate replies via `POST /api/company/reply` (or the scripted agent runs).
6. The bot rejects the voucher and the 150, holds firm, and accepts at or above the floor; the final `offer` has `accepted: true`.
7. `GET /api/negotiations/{id}/report` returns the outcome.

## smoke.sh (draft, in order)

```
curl -sf $B/api/health
curl -sf $B/api/case | head -c 200
ID=$(curl -sf -X POST $B/api/negotiations -H 'Content-Type: application/json' -d '{"speed":3.0}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -sf $B/api/negotiations/$ID | head -c 200
curl -sf "$B/api/negotiations/$ID/history" | head -c 200
curl -sf $B/api/company/inbox | head -c 200
```

## Not in this contract

Voice and phone (stretch). When added, they read the same `EventEnvelope` events and need no changes here.

## Change rule

A contract change means: update this file, run `npm run types`, tell the other person before pushing.
