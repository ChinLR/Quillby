# Backend notes (owner: Person A. Only Person A edits this file.)

Handoff notes for the frontend. Newest first. Keep each entry to a few lines.
Anything that changes an endpoint or schema goes in contract.md too.

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
