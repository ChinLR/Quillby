# Backend notes (owner: Person A. Only Person A edits this file.)

Handoff notes for the frontend. Newest first. Keep each entry to a few lines.
Anything that changes an endpoint or schema goes in contract.md too.

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
