# Backend notes (owner: Person A. Only Person A edits this file.)

Handoff notes for the frontend. Newest first. Keep each entry to a few lines.
Anything that changes an endpoint or schema goes in contract.md too.

## 2026-10-17 Fake airline website: http://localhost:8000/northwind/
One static page (`airline-site/index.html`, served by the backend, no build step, spec in `.plans/airline-site-spec.md`). Its chat widget shows the run from the airline's side, line by line, with Nova's menu buttons, the "Sam joined the chat" handoff and the call banner. Read only: it polls `GET /api/company/inbox`, so there is no contract change. Open it in a second window next to the dashboard.

## 2026-10-17 Name is now Li Ren; live-call findings (no shape changes)
- The demo passenger is **Li Ren** (`case.json`). Labels now read "Counterbot (for Li Ren)" and "Li Ren (you)". Frontend: `Dashboard.tsx` still has the placeholder "Type as Alex…", please change it (and the intake prefill if it names anyone).
- Real phone call tested end to end: the airline dials the number, Counterbot (ElevenLabs voice) answers and negotiates, the run ends `won` with `resolved_on: "call"`.
- **The call transcript is not live.** `on_call` fires when the call connects, but ElevenLabs only fills in the transcript and `duration_seconds` after the call ends, so all `channel: "call"` lines arrive at once at the end. UI: run your own timer from the `on_call` status event and show "Call in progress" until the lines arrive.
- Call lines now have voice tags like "[happy]" stripped. Offers the caller makes on the call arrive as `offer` events, and `best_offer_gbp` equals the accepted amount after a win.
- Fake airline website: the data it needs is already in the stream (`company_bot` and `human_agent` messages with `buttons`). Showing the live chat from `/events` needs no backend change. Keep it out of `/frontend` unless you agree with Person B, or put it in its own folder.

## 2026-10-17 v2 backend is live: intake + call phase (contract v2, all additive)
Pull, run `npm run types`. New things to build, in priority order:
1. **Intake screen** before the dashboard: textarea "What went wrong?" (prefill: "My Northwind flight from Edinburgh to Faro landed almost 4 hours late and they blamed operational reasons. I want my compensation."), optional goal and minimum. `POST /api/intake` returns `{ supported, note, case }`. Show the case as a confirm card plus `note`. If `supported` is false, show the note and disable Start (Start would return 409). Any complaint is accepted; only flight delays run.
2. **Line by line**: the stream is already live. Queue incoming messages and reveal them one at a time, with a typing bubble for `typing_ms` before each. Don't dump history while a run is live.
3. **Sides everywhere** (dashboard and `#/agent`): `customer_bot` and `customer` right, `company_bot` and `human_agent` left, `system` centred.
4. **Call panel** (new statuses `awaiting_call`, `on_call`; new event type `call` with `CallState`):
   - `awaiting_call`: "Northwind is calling Counterbot on {call.phone_number}" (show `call.detail` if not empty, e.g. voice not configured).
   - `on_call`: phone-style panel with a timer (`call.duration_seconds`) and the call transcript: messages with `channel: "call"` (customer_bot = Counterbot's voice, human_agent = caller). Lines may arrive in batches.
   - Fallback buttons while in the call phase: "Record result: £350 cash" / "No deal" -> `POST /api/negotiations/{id}/call/outcome` `{amount_gbp, offer_type}` (`offer_type` "none" = no deal).
   - Pause/Resume are 409 during the call phase: disable them.
5. **Agent window**: once `call_number` in the inbox is not "", show it big ("Call this number now"). The reply box returns 409 after that.
6. **Report**: show `resolved_on` ("Settled on the call") and `call_duration_seconds`.
The cheat sheet now has 5 steps with a `channel` field: chat steps 1-3 (voucher, £150, "say you'll call"), call steps 4-5 (£300, £350).

## 2026-10-17 Real engine is live (shapes unchanged)
- Default `ENGINE=real`: the LLM picks each move (from moves the engine allows) and writes the message and the board reason. Guards check every message; on any LLM problem a template line is used, so a run never stalls.
- The rehearsed run is cached in `backend/cache/` (committed). Same run replays identically; `REPLAY_MODE=1` serves only the cache. A live run takes about 20 s at speed 3, a cached one about 11 s.
- `ENGINE=stub` still plays the old scripted run with no LLM at all.
- Human detection is scored from signals (reply speed, canned phrases, handoff announcement, name). Expect a `detection` event after each company message from stage 3 on, with low confidence until the human appears.
- Mock airline detail: a UK261 citation only counts once the airline has refused ("operational reasons"), so the demo always shows the rebuttal before the handoff.
- Typed agent replies can say amounts in words ("two hundred and eighty pounds"); saying "final offer" below £300 makes the bot walk away (status `walked_away`).

## 2026-10-17 Stub backend is live (every contract endpoint)
- Pull `main`, start `./dev.sh`, then run `npm run types` to get all the shapes in `src/api-types.ts`.
- `POST /api/negotiations` plays a scripted run of the full demo path (no LLM): menu, loop, rule, handoff, offers, won at £350. About 35 s at speed 1; pass `{"speed":3}` for about 12 s.
- Live feed: `EventSource('/api/negotiations/{id}/events')`, each `data` is an `EventEnvelope`. `/history` returns the same events as JSON (typed, and the polling fallback).
- Agent window: `auto_agent` starts **true** (scripted Sam replies). Toggle it off, or just send a reply: a typed reply turns auto-agent off automatically. Amounts are read from the text (e.g. "£150 cash", "£75 voucher").
- Pause, then `POST .../message` for a customer takeover line; resume continues the script.
- After the human appears, the negotiating moves (hold_firm, counter, accept_offer) still use stage 6. Show the `move`, not just the stage name.
- Real engine replaces the script later; shapes will not change.

<!-- Example:
## 2026-10-17 11:40 GET /api/things is live
Returns real seed data. Empty list if no records. Run `npm run types` to pick up the new shape.
-->
