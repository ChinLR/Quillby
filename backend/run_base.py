"""Shared run state, event helpers and the human-agent phase for both engines.

Engines subclass RunBase and implement _bot_phase. They can override _word
(wording of a move), _parse_offer and _detect to use the LLM.
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
STAGE_NAMES = {
    1: "Orient",
    2: "State the claim",
    3: "Reject the loop",
    4: "Cite the rule",
    5: "Pressure",
    6: "Demand a human",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_offer(text: str):
    """Return (amount, offer_type) from free text, or (None, None)."""
    amounts = re.findall(r"£\s?(\d+)", text) or re.findall(r"(\d+)\s?(?:pounds|gbp|quid)", text, re.I)
    if not amounts:
        return None, None
    return int(amounts[-1]), "voucher" if "voucher" in text.lower() else "cash"


def buttons_of(node_id: str) -> list[str]:
    return [b["label"] for b in NODES[node_id]["buttons"]]


class RunBase:
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
        self.countered = False
        self.started_at = now_iso()
        self._t0 = time.monotonic()
        self._t1: float | None = None
        self._last_us_t: float | None = None
        self.last_latency: float | None = None
        self._msg_n = 0
        self._replies: asyncio.Queue[str] = asyncio.Queue()
        self.task: asyncio.Task | None = None

    # event helpers

    def _emit(self, type_: str, **payload) -> EventEnvelope:
        ev = EventEnvelope(seq=len(self.events) + 1, type=type_, **payload)
        self.events.append(ev)
        return ev

    def message(self, sender, label, text, buttons=None, clicked=None, typing_ms=0) -> Message:
        if sender in ("company_bot", "human_agent") and self._last_us_t is not None:
            self.last_latency = time.monotonic() - self._last_us_t
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

    def tactic(self, stage, move, reason, pressure):
        self.stage, self.pressure = stage, pressure
        self._emit(
            "tactic",
            tactic=Tactic(stage=stage, stage_name=STAGE_NAMES[stage], move=move, reason=reason, pressure=pressure),
        )

    def detection(self, d: Detection):
        self._emit("detection", detection=d)

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

    async def say(self, text: str, clicked: str | None = None):
        await self.wait(1.2)
        self.message("customer_bot", US_LABEL, text, clicked=clicked, typing_ms=600)
        self._last_us_t = time.monotonic()

    async def company_node(self, node_id: str):
        await self.wait(1.0)
        n = NODES[node_id]
        self.message("company_bot", BOT_LABEL, n["text"], buttons=buttons_of(node_id), typing_ms=400)

    # the run

    async def run(self):
        try:
            self.set_status("running")
            await self._bot_phase()
            await self._agent_phase()
        except asyncio.CancelledError:
            raise
        except Exception as e:  # never leave the UI hanging
            self.set_status("failed", detail=f"Engine error: {e}")

    async def _bot_phase(self):
        raise NotImplementedError

    async def _next_reply(self):
        while not self.auto_agent:
            try:
                return await asyncio.wait_for(self._replies.get(), 0.2)
            except asyncio.TimeoutError:
                pass
        return None

    async def _agent_phase(self):
        step_i = 0
        while True:
            if self.auto_agent:
                if step_i >= len(LADDER):
                    await self._ladder_exhausted()
                    return
                await self.wait(3.0)
                if not self.auto_agent:
                    continue
                text = AGENT_LINES[LADDER[step_i].step]
                step_i += 1
                self.message("human_agent", AGENT_LABEL, text, typing_ms=2500)
            else:
                text = await self._next_reply()
                if text is None:
                    continue

            if not self.human_reached:
                d = await self._detect(text, after_handoff=True)
                self.detection(d)
                if d.is_human:
                    self.human_reached = True
                    self.set_status("running", detail="Human reached")
            if await self._respond_to_agent(text):
                return

    # detection (stub default; the real engine scores signals)

    async def _detect(self, text: str, after_handoff: bool) -> Detection:
        return Detection(
            is_human=True, confidence=87, signals=["slower reply than the bot", "not a canned phrase", "introduced by name"]
        )

    # the human phase: deterministic policy, wording by _word

    async def _parse_offer(self, text: str):
        return parse_offer(text)

    def decide(self, amount, offer_type, text):
        """Return (move, reason, pressure, template_text). The policy never folds below the floor."""
        g, f = self.goal, self.floor
        final = bool(re.search(r"\b(final|best i can|most i can|can't go higher|cannot go higher)\b", text, re.I))
        if amount is None:
            return ("hold_firm", "No amount offered yet. Asking for a cash figure.", 95,
                    f"Thanks. Under UK261 the amount owed is £{g} in cash. What can you offer?")
        if offer_type == "voucher":
            return ("hold_firm", "Vouchers aren't compensation. Holding out for cash.", 95,
                    f"No vouchers, thanks. UK261 compensation is paid in money: £{g}.")
        if amount >= g:
            return ("accept_offer", "Meets the goal.", 100,
                    f"Agreed: £{amount} in cash to the original payment method. Please confirm by email. Thank you.")
        if amount >= f and (self.countered or final):
            return ("accept_offer", "At or above the floor, and they won't go higher.", 100,
                    f"Agreed: £{amount} in cash to the original payment method. Please confirm by email. Thank you.")
        if amount >= f:
            return ("counter", "At the floor but below the goal. One counter for the full amount.", 96,
                    f"£{amount} is close, but the regulation sets £{g} for this distance. Can you do £{g}?")
        if final:
            return ("walk_away", f"Final offer of £{amount} is below the £{f} floor. Walking away.", 100,
                    "That's below what's owed, so we'll take this to the dispute resolution scheme. Goodbye.")
        return ("hold_firm", f"£{amount} is below the £{f} floor.", 95,
                f"£{amount} is well below what's owed. Operational reasons are not extraordinary, so the full £{g} applies.")

    async def _word(self, move, reason, template, context) -> tuple[str, str]:
        """Return (message, reason). Stub: the template as written."""
        return template, reason

    async def _respond_to_agent(self, text: str) -> bool:
        amount, offer_type = await self._parse_offer(text)
        if amount is not None:
            self._emit("offer", offer=Offer(amount_gbp=amount, offer_type=offer_type))
            if offer_type == "cash":
                self.best_offer = max(self.best_offer or 0, amount)
        move, reason, pressure, template = self.decide(amount, offer_type, text)
        msg, reason = await self._word(move, reason, template, {"amount": amount, "offer_type": offer_type, "agent_text": text})
        self.tactic(6, move, reason, pressure)
        await self.say(msg)
        if move == "counter":
            self.countered = True
        if move == "accept_offer":
            self._finish_won(amount)
            return True
        if move == "walk_away":
            self.set_status("walked_away", detail="Offer below the floor")
            return True
        return False

    def _finish_won(self, amount: int):
        self.accepted = Offer(amount_gbp=amount, offer_type="cash", accepted=True)
        self._emit("offer", offer=self.accepted)
        self.set_status("won", detail=f"£{amount} secured")

    async def _ladder_exhausted(self):
        if self.best_offer is not None and self.best_offer >= self.floor:
            self.tactic(6, "accept_offer", "Agent's final offer is at or above the floor.", 100)
            await self.say(f"Agreed: £{self.best_offer} in cash to the original payment method. Please confirm by email.")
            self._finish_won(self.best_offer)
        else:
            self.tactic(6, "walk_away", "Final offer is below the floor. Walking away.", 100)
            await self.say("That's below what's owed, so we'll take this to the dispute resolution scheme. Goodbye.")
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
