# Frontend notes (owner: Person B. Only Person B edits this file.)

Handoff notes for the backend. Newest first. Keep each entry to a few lines.
Use this for things like "I need field X on /api/things" or "screen Y is waiting on endpoint Z".

## 2026-10-17 Counterbot should introduce itself to the human agent
The customer wants Counterbot to keep fighting on its own and to introduce itself, not hand the chat to the customer. The frontend no longer pauses the run on a voucher or low offer (it only shows an alert, with an optional "Step in").
Request for the engine: when the first `human_agent` message arrives, Counterbot's next line should say who it is before negotiating, e.g. "Hello Sam, I'm Counterbot, the assistant acting for Alex Morgan on booking NW4821. I'll be dealing with this on Alex's behalf." No endpoint or schema change, just wording of that one `customer_bot` message.

## 2026-10-17 Need a way for the customer to accept or end the talks
The frontend now hands the wheel to the customer when the airline agent says it cannot offer more (final-offer wording, or the same offer twice). It pauses the run at that point. I tested it: a typed customer message ("I accept £200 in cash") is ignored by the engine, and on resume it walked away because £200 is below the floor. So the customer cannot actually accept or end the talks from the UI.
Please add something like `POST /api/negotiations/{id}/decision` with `{ action: "accept" | "walk_away" | "continue", amount_gbp?: int }` that settles at the agent's last offer even below the floor (the customer overrides), or ends the run, and returns `NegotiationState`. I will add Accept and Walk away buttons as soon as it is in `/openapi.json`.

<!-- Example:
## 2026-10-17 11:55 Need a score field
The results card shows a score. Please add `score: int` to the /api/things items.
-->
