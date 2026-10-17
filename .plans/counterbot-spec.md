# Counterbot: Spec

Edinburgh AI Hackathon. ~5 hours of build, 2 people. Optimise for a flawless demo path, not coverage.
Status: draft from the interview on 2026-10-17. Read once and fix anything wrong before writing the contract.

Name: Counterbot. The end goal is our bot against their human. Beating the company's bot is only the means to get there.

## One-liner

Companies put bots between customers and humans. We flip it: the customer's own bot fights the company's bot, wears it down, forces a human agent to take over, and then negotiates with that human until the customer gets paid.

Pitch line: "Companies automated customer service to avoid talking to you. We automated you to make them talk."

## The flip (theme fit)

| Assumed | Flipped |
| --- | --- |
| The customer fights the company's bot | The customer's bot fights the company's bot |
| The bot is the wall that keeps humans away | Our bot's job is to pry the human out |
| Humans escalate only when they give up | The company is forced to escalate by pressure |

## Decisions locked in the interview

| Topic | Decision |
| --- | --- |
| Hero scenario | Delayed flight compensation |
| Win condition | Refund secured after a human is reached (two beats: force a human out, then negotiate the amount) |
| How our bot reads the company bot | Structured messages from our own mock (JSON: text plus a list of buttons). Pitch honestly as "works on any bot that exposes this; adapters later". |
| LLM role | The LLM picks the tactic and writes the wording live. Every call is cached to disk so a rehearsed run replays identically. |
| Mock bot handoff | Deterministic pressure rules (see below), so it works on every run |
| Human agent | A teammate in a second browser window, following a hidden concession ladder. A scripted fallback agent can take over. |
| Run mode | One-click autopilot with a pause / take-over button |
| Legal grounding | Real UK261 delay-compensation rules as a short seeded excerpt, labelled "not legal advice" |
| Voice and phone | Stretch only. A separate module. Never on the core demo path. |

## Users and roles

- Customer: runs the bot from the dashboard. Fictional passenger, mock auth (one fixed demo account).
- Our bot: the negotiator, acting for the customer.
- Company bot: the fictional airline's deliberately annoying support chat (ours, mocked).
- Human agent: a teammate role-playing in `#/agent`.

## Core features (must work end to end as text)

1. **Read the company bot.** Every company message arrives as structured data: text plus quick-reply buttons. Our bot detects loops (same menu or same canned reply twice) and dead ends (no useful button).
2. **Plan a tactic.** The bot holds a goal, a floor (walk-away) and an escalation ladder. The board shows the stage, and a one-line reason for each move.
3. **Negotiate like a human and push for a human.** Refuse menu options, say "my issue isn't listed", repeat the request for an agent. Hold firm on the ask, do not fold on the first voucher, accept a fair counter-offer at or above the floor.
4. **Detect the switch to a human** from signals (see below) and react with a "human reached" moment.
5. **Tactic board.** Live panel next to the chat: current stage, reasoning, pressure meter (0 to 100) that climbs as the bot escalates.
6. **Outcome report.** Amount won, time saved, and the full transcript.

(Numbering follows the original prompt: voice was feature 5 and is now the stretch goal.)

## Stretch (only after the core works end to end)

- ElevenLabs voices: one per side, a "listen in" toggle, audio pre-generated and cached.
- Phone call: our bot phones one of the two of us; the other role-plays the human agent. Requires an ElevenLabs account, a phone provider and the teammate's consent.
- Build voice as a module that only reads the core's message events (`backend/voice.py`). Deleting it must not break anything.

## Hero case (seed)

All names are fictional. No real brands.

- Passenger: Alex Morgan, booking ref `NW4821`.
- Airline: Northwind Air (fictional).
- Flight: Edinburgh to Faro, scheduled arrival 11:10, actual arrival 15:05 (3 h 55 min late).
- Airline's stated reason: "operational reasons" (not an extraordinary circumstance).
- Customer goal: GBP 350 cash. Floor: GBP 300 cash. Vouchers are refused.
- Seeded legal excerpt (UK261 summary, to be verified against the official text before the demo): compensation applies for arrival delays of 3 hours or more; amount depends on distance band (about GBP 220 / 350 / 520); not owed if the delay was caused by extraordinary circumstances outside the airline's control. Verify the distance band for Edinburgh to Faro, and the wording, before relying on it. One teammate owns this check.

## Bot tactic ladder (our side)

| Stage | What the bot does | Pressure |
| --- | --- | --- |
| 1 Orient | Reads the menu, picks the closest option | 0 to 10 |
| 2 State the claim | Polite, factual: booking ref, delay, claim amount | 10 to 25 |
| 3 Reject the loop | Refuses "Did that help? Yes/No", says the issue is not listed | 25 to 45 |
| 4 Cite the rule | Quotes UK261 and refutes "operational reasons" | 45 to 65 |
| 5 Pressure | Mentions a chargeback, a public review, a regulator complaint (stays honest and truthful) | 65 to 85 |
| 6 Demand a human | Repeats the demand for an agent until it is granted | 85 to 100 |

Rules for the bot:
- It never invents facts. It only uses the case file and the seeded excerpt.
- It never claims to be a person. It says it is the customer's assistant.
- Each move shows a one-line reason on the board ("Rejecting the loop: third identical apology").

## Mock company bot behaviour (deterministic)

- Annoying by design: menu trees, repeated apologies, a "Did that help? Yes/No" trap, refusal to discuss compensation without the right button.
- Handoff rule (all must be true): the bot has rejected the loop at least twice, AND cited the regulation at least once, AND asked for a human at least twice. Then it says "Connecting you to a colleague..." and the human agent window receives the chat.
- Messages are structured: `{ id, sender_label, text, buttons: [string], typing_ms }`. `sender_label` is shown to the audience but our bot detects the switch from signals, not from the label.

## Detecting the switch (our bot)

Signals combined into a confidence score shown on the board:
- Latency (slower than the bot's usual instant replies)
- Not matching known canned phrases
- Typos or informal wording
- A handoff announcement ("connecting you to...")
When confidence passes a threshold, the "human reached" banner fires and the bot switches to human-negotiation mode.

## Human agent window (`#/agent`)

- Shows the incoming chat and a reply box.
- A hidden cheat sheet panel (visible only on this page) with the concession ladder:
  1. Offer a voucher worth GBP 75.
  2. Offer GBP 150 cash.
  3. Offer GBP 300 cash.
  4. Settle at GBP 350 cash only if our bot holds firm and refutes "operational reasons".
- Free wording; the amounts follow the ladder.
- "Auto-agent" button: a scripted agent takes over with the same ladder, as the fallback.

## Main dashboard (customer view)

Single screen:
- Left: the chat between our bot and the company (customer-facing view).
- Right: tactic board (stage, reasoning, pressure meter, detection confidence).
- Controls: Start, Pause / Take over, Reset demo.
- Top: case summary (flight, delay, claim, goal and floor).
- On human reached: a banner and a distinct visual change.
- On completion: outcome report with amount won, time saved, transcript.

## Architecture

- Backend (FastAPI): the mock company service, the negotiator, the LLM client (`backend/llm.py`), a background negotiation runner.
- Frontend (React + Vite + Tailwind): dashboard and `#/agent` page; all calls through `src/api.ts`; types generated from `/openapi.json`.
- Live updates: server-sent events from the backend (Default chosen by me, not asked; revisit if SSE gives trouble. Polling every second is the fallback).
- LLM: Nebius via `backend/llm.py`. Use a fast model from the benchmark, raise `max_tokens` for reasoning models, cache every call, validate small flat JSON with Pydantic, retry once, then fall back to a canned line.
- Replay mode: an env flag that serves only cached LLM responses, so the rehearsed run is repeatable.
- Data: seeded JSON in `backend/seed/` (case file, UK261 excerpt, company bot script, concession ladder). Mock auth only.

## Draft endpoints (contract to be written separately)

- `GET  /api/case` returns the case file.
- `POST /api/negotiation/start` returns a negotiation id.
- `GET  /api/negotiation/{id}/events` streams chat, tactic and pressure events.
- `POST /api/negotiation/{id}/pause` and `/resume`.
- `POST /api/negotiation/{id}/message` posts a customer-side takeover message.
- `GET  /api/negotiation/{id}/report` returns the outcome report.
- `GET  /api/company/{id}/inbox` and `POST /api/company/{id}/reply` for the human agent window.
- `POST /api/company/{id}/auto-agent` toggles the scripted fallback.
- `POST /api/reset` resets the demo.

## LLM outputs (small and flat)

- Tactic step: `{ "stage": "string", "reason": "string", "message": "string", "pressure": 0 }`
- Human detection: `{ "is_human": true, "confidence": 0, "signals": ["string"] }`
- Human reply analysis: `{ "offer_gbp": 0, "offer_type": "string", "accept": false }`

## Demo script (about 3 minutes)

1. Show the case: Alex's flight was 3 h 55 min late, the airline offers nothing. Goal GBP 350.
2. Press Start. Our bot works through the airline's menu and loops while the board narrates its tactic.
3. The bot refuses the "Did that help?" trap and states the claim. Pressure climbs.
4. The bot cites UK261 and refutes "operational reasons". The company bot gives up and hands over.
5. "Human reached" fires. The teammate takes the chat in the second window.
6. The bot rejects the voucher, rejects GBP 150, and holds firm until the agent reaches the settlement.
7. Outcome report: GBP 350 won, time saved, transcript.
(Stretch: replay the exchange with voices, then the live phone call.)

## Acceptance checks

- The mock handoff fires on every run of the demo script.
- A cached replay reproduces the same transcript.
- The human-reached banner fires from the signals, with no explicit label from the mock.
- The scripted agent completes the arc if the live teammate fails.
- Every chat and board screen has loading and error states; no blank screens.
- The tactic board shows a reason for every move.

## Out of scope

Real company integrations, scraping, real auth, payments, multi-language, file upload, email, any scenario other than the hero case, anything not in the demo script.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| LLM slow or invalid JSON during the demo | Fast model, generous `max_tokens`, cache, replay mode, canned fallback line |
| Live teammate stalls or goes off script | Cheat-sheet ladder; scripted agent fallback |
| Handoff does not fire | Deterministic rules plus a reset button |
| Legal excerpt is wrong | Teammate verifies against the official text before the demo; "not legal advice" label |
| Judges question honesty | The bot only uses case facts, never impersonates a person; say so in the pitch |
| Scope creep into voice | Voice is a separate module and only starts after the core demo path passes |

## Ownership

- Person A (`/backend`): mock company service, negotiator, LLM prompts and caching, SSE, seed data, report.
- Person B (`/frontend`): dashboard, tactic board, agent window, banners, polish.
- Both: `contract.md`, this spec, the demo script.
- Final scope calls: decide who decides before building starts.

## Open items (defaults I chose, please confirm or change)

1. SSE for live updates (fallback: polling).
2. Concession ladder amounts (75 / 150 / 300 / 350).
3. Which LLM from the benchmark is used live and which is the backup.
4. Who plays the human agent live, who drives the demo.
5. Distance band and amount for Edinburgh to Faro (needs verification).
