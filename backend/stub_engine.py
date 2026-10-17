"""Scripted stand-in for the real negotiator.

Plays the whole demo path as contract events, with no LLM calls, so the
frontend can be built against real shapes. The real engine replaces this
module and keeps the same Run interface.
"""

import asyncio
import json
import pathlib
import re
import time
from datetime import datetime, timezone

from models import (
    Case,
    ConcessionStep,
    Detection,
    EventEnvelope,
    Message,
    NegotiationState,
    Offer,
    Report,
    StatusUpdate,
    Tactic,
)

SEED = pathlib.Path(__file__).parent / "seed"


def _load(name: str):
    return json.loads((SEED / name).read_text())


CASE = Case(**_load("case.json"))
COMPANY = _load("company_bot.json")
LADDER = [ConcessionStep(**s) for s in _load("concession_ladder.json")]
AGENT_LINES = {line["step"]: line["text"] for line in _load("scripted_agent.json")["lines"]}
NODES = {n["id"]: n for n in COMPANY["nodes"]}

BOT_LABEL = "Nova (Northwind Assistant)"
AGENT_LABEL = "Sam (Northwind Support)"
US_LABEL = "Counterbot (for Alex)"
CUSTOMER_LABEL = "Alex (you)"

FINISHED = ("won", "walked_away", "failed")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_offer(text: str):
    """Return (amount, offer_type) from free text, or (None, None)."""
    amounts = re.findall(r"£\s?(\d+)", text) or re.findall(r"(\d+)\s?(?:pounds|gbp)", text, re.I)
    if not amounts:
        return None, None
    return int(amounts[-1]), "voucher" if "voucher" in text.lower() else "cash"


def _buttons(node_id: str) -> list[str]:
    return [b["label"] for b in NODES[node_id]["buttons"]]


class Run:
    def __init__(self, nid: str, goal: int, floor: int, speed: float):
        self.id = nid
        self.goal = goal
        self.floor = floor
        self.speed = speed
        self.events: list[EventEnvelope] = []
        self.status = "running"
        self.human_reached = False
        self.handed_off = False
        self.auto_agent = True
        self.paused = False
        self.stage = 0
        self.pressure = 0
        self.best_offer: int | None = None
        self.accepted: Offer | None = None
        self.started_at = now_iso()
        self._t0 = time.monotonic()
        self._t1: float | None = None
        self._msg_n = 0
        self._replies: asyncio.Queue[str] = asyncio.Queue()
        self.task: asyncio.Task | None = None

    # event helpers

    def _emit(self, type_: str, **payload) -> EventEnvelope:
        ev = EventEnvelope(seq=len(self.events) + 1, type=type_, **payload)
        self.events.append(ev)
        return ev

    def message(self, sender, label, text, buttons=None, clicked=None, typing_ms=0) -> Message:
        self._msg_n += 1
        m = Message(
            id=f"m{self._msg_n}",
            sender=sender,
            sender_label=label,
            text=text,
            buttons=buttons or [],
            clicked_button=clicked,
            typing_ms=typing_ms,
            created_at=now_iso(),
        )
        self._emit("message", message=m)
        return m

    def tactic(self, stage, name, move, reason, pressure):
        self.stage, self.pressure = stage, pressure
        self._emit("tactic", tactic=Tactic(stage=stage, stage_name=name, move=move, reason=reason, pressure=pressure))

    def set_status(self, status, detail=""):
        self.status = status
        if status in FINISHED:
            self._t1 = time.monotonic()
        self._emit("status", status=StatusUpdate(status=status, human_reached=self.human_reached, detail=detail))

    def pause(self):
        self.paused = True
        self.set_status("paused")

    def resume(self):
        self.paused = False
        self.set_status("running")

    def post_agent_reply(self, text: str) -> Message:
        # A typed reply takes over from the scripted agent.
        self.auto_agent = False
        m = self.message("human_agent", AGENT_LABEL, text, typing_ms=0)
        self._replies.put_nowait(text)
        return m

    async def wait(self, seconds: float):
        target, waited = seconds / self.speed, 0.0
        while waited < target or self.paused:
            await asyncio.sleep(0.1)
            if not self.paused:
                waited += 0.1

    # the scripted run

    async def run(self):
        try:
            self.set_status("running")
            await self._bot_phase()
            await self._agent_phase()
        except asyncio.CancelledError:
            raise
        except Exception as e:  # never leave the UI hanging
            self.set_status("failed", detail=f"Stub engine error: {e}")

    async def _company(self, node_id: str):
        await self.wait(1.0)
        n = NODES[node_id]
        self.message("company_bot", BOT_LABEL, n["text"], buttons=_buttons(node_id), typing_ms=400)

    async def _us(self, text: str, clicked: str | None = None):
        await self.wait(1.2)
        self.message("customer_bot", US_LABEL, text, clicked=clicked, typing_ms=600)

    async def _bot_phase(self):
        c = CASE
        await self._company("welcome")
        self.tactic(1, "Orient", "click_button", "No compensation option in the menu. 'Something else' is the closest.", 5)
        await self._us("Something else", clicked="Something else")

        await self._company("popular")
        self.tactic(2, "State the claim", "state_claim", "The menu has no claim option, so state the claim directly.", 18)
        await self._us(
            f"Hi, I'm an assistant acting for {c.passenger_name}. None of these fit. Flight {c.flight_number} "
            f"from Edinburgh to Faro (booking {c.booking_ref}) arrived 3 h 55 min late. "
            f"We're claiming £{self.goal} compensation."
        )

        await self._company("apology")
        self.tactic(3, "Reject the loop", "reject_loop", "Canned apology plus a Yes/No trap. Refusing it.", 32)
        await self._us("No. An apology isn't a resolution, and my issue isn't listed. I need to speak to a person.", clicked="No")

        await self._company("apology_loop")
        self.tactic(3, "Reject the loop", "reject_loop", "Same apology twice: loop detected. Rejecting again and repeating the request for a human.", 42)
        await self._us("You've sent the same reply twice, so this is a loop. Please transfer me to a human agent.")

        await self._company("deflect")
        self.tactic(4, "Cite the rule", "cite_rule", "'Operational reasons' is not an extraordinary circumstance under UK261.", 60)
        await self._us(
            "Under UK261, an arrival delay of 3 hours or more on a flight of 1,500 to 3,500 km is owed £350, "
            "unless extraordinary circumstances caused it. Operational reasons are not extraordinary. Please escalate this."
        )

        self.tactic(5, "Pressure", "pressure", "No movement after citing the rule. Naming the next steps, truthfully.", 78)
        await self._us("If this isn't resolved here, I'll take it to the airline's dispute resolution scheme and leave a public review.")

        self.tactic(6, "Demand a human", "demand_human", "Handoff conditions met: 2 loop rejections, 1 rule citation, 2 human requests.", 92)
        await self._us("Human agent, please.")

        await self.wait(1.0)
        self.message("company_bot", BOT_LABEL, COMPANY["handoff_message"], typing_ms=400)
        self.handed_off = True

    async def _next_reply(self):
        while not self.auto_agent:
            try:
                return await asyncio.wait_for(self._replies.get(), 0.2)
            except asyncio.TimeoutError:
                pass
        return None

    async def _agent_phase(self):
        step_i, countered, first = 0, False, True
        while True:
            if self.auto_agent:
                if step_i >= len(LADDER):
                    await self._settle_or_walk()
                    return
                await self.wait(2.5)
                if not self.auto_agent:
                    continue
                step = LADDER[step_i]
                step_i += 1
                text = AGENT_LINES[step.step]
                self.message("human_agent", AGENT_LABEL, text, typing_ms=2500)
            else:
                text = await self._next_reply()
                if text is None:
                    continue

            if first:
                first = False
                self._emit(
                    "detection",
                    detection=Detection(
                        is_human=True,
                        confidence=87,
                        signals=["slower reply than the bot", "not a canned phrase", "introduced by name"],
                    ),
                )
                self.human_reached = True
                self.set_status("running", detail="Human reached")

            amount, offer_type = parse_offer(text)
            await self.wait(1.0)
            if amount is None:
                self.tactic(6, "Demand a human", "hold_firm", "No amount offered yet. Asking for a cash figure.", 95)
                await self._us(f"Thanks. Under UK261 the amount owed is £{self.goal} in cash. What can you offer?")
                continue

            self._emit("offer", offer=Offer(amount_gbp=amount, offer_type=offer_type))
            if offer_type == "cash":
                self.best_offer = max(self.best_offer or 0, amount)

            if offer_type == "voucher":
                self.tactic(6, "Demand a human", "hold_firm", "Vouchers aren't compensation. Holding out for cash.", 95)
                await self._us(f"No vouchers, thanks. UK261 compensation is paid in money: £{self.goal}.")
            elif amount >= self.goal or (amount >= self.floor and countered):
                await self._accept(amount, "Meets the goal." if amount >= self.goal else "At or above the floor after one counter.")
                return
            elif amount >= self.floor:
                countered = True
                self.tactic(6, "Demand a human", "counter", "At the floor but below the goal. One counter for the full amount.", 96)
                await self._us(f"£{amount} is close, but the regulation sets £{self.goal} for this distance. Can you do £{self.goal}?")
            else:
                self.tactic(6, "Demand a human", "hold_firm", f"£{amount} is below the £{self.floor} floor.", 95)
                await self._us(
                    f"£{amount} is well below what's owed. Operational reasons are not extraordinary, so the full £{self.goal} applies."
                )

    async def _accept(self, amount: int, reason: str):
        self.tactic(6, "Demand a human", "accept_offer", reason, 100)
        await self._us(f"Agreed: £{amount} in cash to the original payment method. Please confirm by email. Thank you.")
        self.accepted = Offer(amount_gbp=amount, offer_type="cash", accepted=True)
        self._emit("offer", offer=self.accepted)
        self.set_status("won", detail=f"£{amount} secured")

    async def _settle_or_walk(self):
        if self.best_offer is not None and self.best_offer >= self.floor:
            await self._accept(self.best_offer, "Agent's final offer is at or above the floor.")
        else:
            self.tactic(6, "Demand a human", "walk_away", "Final offer is below the floor. Walking away.", 100)
            await self._us("That's below what's owed, so we'll take this to the dispute resolution scheme. Goodbye.")
            self.set_status("walked_away", detail="Offer below the floor")

    # read models

    def state(self) -> NegotiationState:
        return NegotiationState(
            id=self.id,
            status=self.status,
            human_reached=self.human_reached,
            stage=self.stage,
            pressure=self.pressure,
            best_offer_gbp=self.best_offer,
            goal_gbp=self.goal,
            floor_gbp=self.floor,
            started_at=self.started_at,
        )

    def messages(self) -> list[Message]:
        return [e.message for e in self.events if e.message]

    def report(self) -> Report:
        msgs = self.messages()
        bot_count = sum(1 for m in msgs if m.sender == "customer_bot")
        stages: list[str] = []
        for e in self.events:
            if e.tactic and e.tactic.stage_name not in stages:
                stages.append(e.tactic.stage_name)
        end = self._t1 or time.monotonic()
        return Report(
            outcome=self.status,
            amount_gbp=self.accepted.amount_gbp if self.accepted else 0,
            offer_type=self.accepted.offer_type if self.accepted else "none",
            goal_gbp=self.goal,
            floor_gbp=self.floor,
            duration_seconds=round(end - self._t0),
            bot_message_count=bot_count,
            estimated_minutes_saved=2 * bot_count,
            stages_reached=stages,
            transcript=msgs,
        )
