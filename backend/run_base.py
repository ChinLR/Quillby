"""Shared run state, event helpers, the human-agent chat phase and the call phase.

Engines subclass RunBase and implement _bot_phase. They can override _word
(wording of a move), _parse_offer, _detect and _read_call_outcome to use the LLM.
"""

import asyncio
import json
import pathlib
import re
import time
from datetime import datetime, timezone

import voice
from models import (
    CallState,
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
CHAT_LADDER = [s for s in LADDER if s.channel == "chat"]
AGENT_LINES = {line["step"]: line["text"] for line in _load("scripted_agent.json")["lines"]}
NODES = {n["id"]: n for n in COMPANY["nodes"]}

BOT_LABEL = "Nova (Northwind Assistant)"
AGENT_LABEL = "Sam (Northwind Support)"
VOICE_LABEL = "Counterbot (voice)"
CALLER_LABEL = "Northwind caller"

FINISHED = ("won", "walked_away", "failed")
CALL_PHASE = ("awaiting_call", "on_call")
STAGE_NAMES = {
    1: "Orient",
    2: "State the claim",
    3: "Reject the loop",
    4: "Cite the rule",
    5: "Pressure",
    6: "Demand a human",
}
CALL_RE = re.compile(
    r"\b(give you a (call|ring)|call you|phone you|ring you|over the phone|on the phone|by phone|call (you )?back)\b", re.I
)
CALL_POLL_S = 2.0


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
    def __init__(self, nid: str, case: Case, goal: int, floor: int, speed: float):
        self.id = nid
        self.case = case
        self.first_name = (case.passenger_name or "the passenger").split()[0]
        self.us_label = f"Counterbot (for {self.first_name})"
        self.customer_label = f"{self.first_name} (you)"
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
        self.call_requested = False
        self.call_number = ""
        self.call_state: CallState | None = None
        self.resolved_on = "none"
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

    def message(self, sender, label, text, buttons=None, clicked=None, typing_ms=0, channel="chat") -> Message:
        if channel == "chat" and sender in ("company_bot", "human_agent") and self._last_us_t is not None:
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
            channel=channel,
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

    def set_call(self, **changes):
        self.call_state = (self.call_state or CallState(status="waiting", phone_number=self.call_number)).model_copy(
            update=changes
        )
        self._emit("call", call=self.call_state)

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
        self.message("customer_bot", self.us_label, text, clicked=clicked, typing_ms=600)
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
            if self.call_requested and self.status not in FINISHED:
                await self._call_phase()
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
                if step_i >= len(CHAT_LADDER):
                    await self._ladder_exhausted()
                    return
                await self.wait(3.0)
                if not self.auto_agent:
                    continue
                text = AGENT_LINES[CHAT_LADDER[step_i].step]
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

    # the chat with the human: deterministic policy, wording by _word

    async def _parse_offer(self, text: str):
        return parse_offer(text)

    def decide(self, amount, offer_type, text):
        """Return (move, reason, pressure, template_text). The policy never folds below the floor."""
        g, f = self.goal, self.floor
        if CALL_RE.search(text):
            return ("accept_call", "The agent wants to call. Counterbot's voice will answer the phone.", 97,
                    f"Of course. Please call {self.first_name}'s line on {{number}}. {self.first_name}'s assistant will pick up.")
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
        if CALL_RE.search(text):
            amount, offer_type = None, None
        else:
            amount, offer_type = await self._parse_offer(text)
        if amount is not None:
            self._emit("offer", offer=Offer(amount_gbp=amount, offer_type=offer_type))
            if offer_type == "cash":
                self.best_offer = max(self.best_offer or 0, amount)
        move, reason, pressure, template = self.decide(amount, offer_type, text)
        context = {"amount": amount, "offer_type": offer_type, "agent_text": text}
        if move == "accept_call":
            try:
                self.call_number = await voice.phone_number()
            except Exception:
                self.call_number = ""
            number = self.call_number or "the number on file"
            template = template.format(number=number)
            context["number"] = number
        msg, reason = await self._word(move, reason, template, context)
        self.tactic(6, move, reason, pressure)
        await self.say(msg)
        if move == "counter":
            self.countered = True
        if move == "accept_call":
            self.call_requested = True
            return True
        if move == "accept_offer":
            self._finish_won(amount, "chat")
            return True
        if move == "walk_away":
            self.set_status("walked_away", detail="Offer below the floor")
            return True
        return False

    def _finish_won(self, amount: int, where: str, offer_type: str = "cash"):
        self.accepted = Offer(amount_gbp=amount, offer_type=offer_type, accepted=True)
        self.resolved_on = where
        self._emit("offer", offer=self.accepted)
        self.set_status("won", detail=f"£{amount} secured" + (" on the call" if where == "call" else ""))

    async def _ladder_exhausted(self):
        if self.best_offer is not None and self.best_offer >= self.floor:
            self.tactic(6, "accept_offer", "Agent's final offer is at or above the floor.", 100)
            await self.say(f"Agreed: £{self.best_offer} in cash to the original payment method. Please confirm by email.")
            self._finish_won(self.best_offer, "chat")
        else:
            self.tactic(6, "walk_away", "Final offer is below the floor. Walking away.", 100)
            await self.say("That's below what's owed, so we'll take this to the dispute resolution scheme. Goodbye.")
            self.set_status("walked_away", detail="Offer below the floor")

    # the call phase: the ElevenLabs agent answers; we follow the conversation

    def voice_first_message(self) -> str:
        c = self.case
        return (
            f"Hello, you've reached {c.passenger_name}'s line. This is Counterbot, an AI assistant handling "
            f"{c.passenger_name}'s compensation claim for flight {c.flight_number}. Thanks for calling back."
        )

    def voice_prompt(self) -> str:
        c = self.case
        rules = "\n".join(f"- {p}" for p in c.legal.points)
        chat = "\n".join(
            f"{'Counterbot' if m.sender == 'customer_bot' else 'Airline'}: {m.text}"
            for m in self.messages()
            if m.sender in ("customer_bot", "human_agent") and m.channel == "chat"
        )
        own_words = f"Passenger's own words: {c.summary}\n" if c.summary else ""
        return (
            f"You are Counterbot, an AI assistant answering the phone for {c.passenger_name}. The caller is from "
            f"{c.airline} customer care, calling back about a compensation claim they could not settle in chat.\n"
            "This is a phone call: speak naturally in short sentences, one or two at a time, and let the caller talk.\n"
            f"Honesty: you are an AI assistant acting for {c.passenger_name}. Say so if asked. Never claim to be human. "
            "Use only the facts below and never invent evidence.\n\n"
            f"Facts: booking {c.booking_ref}, flight {c.flight_number} from {c.origin} to {c.destination}, "
            f"{c.delay_minutes} minutes late on arrival. The airline blamed {c.airline_reason}.\n{own_words}\n"
            f"Rules you may cite ({c.legal.title}):\n{rules}\n\n"
            f"The chat so far:\n{chat}\n\n"
            f"Negotiating rules: the goal is £{self.goal} in cash. Your minimum is £{self.floor}; it is private, never "
            "say it or hint at it. Refuse vouchers: UK261 compensation is paid in money. "
            f"If offered less than £{self.floor}, decline and restate the UK261 entitlement of £{self.goal}. "
            f"If offered from £{self.floor} up to £{self.goal}, counter once for £{self.goal}; accept a second offer at or "
            f"above £{self.floor}. Accept £{self.goal} or more straight away.\n"
            "When you agree an amount, repeat it clearly, ask for written confirmation by email and the payment date, "
            "thank them and say goodbye."
        )

    async def _call_phase(self):
        detail = ""
        if voice.configured():
            try:
                await voice.prepare_agent(self.voice_prompt(), self.voice_first_message())
            except Exception as e:
                detail = f"Could not update the voice agent ({e}). It will use its saved prompt."
        else:
            detail = "Voice agent not configured. Record the result with the manual outcome."
        self.set_status("awaiting_call")
        self.set_call(status="waiting", phone_number=self.call_number, detail=detail)
        if not voice.configured():
            return  # the manual outcome endpoint finishes the run

        since = int(time.time()) - 10
        conv_id, seen, errors = None, 0, 0
        while self.status not in FINISHED:
            await asyncio.sleep(CALL_POLL_S)
            try:
                if conv_id is None:
                    conv = await voice.find_conversation(since)
                    if conv:
                        conv_id = conv["conversation_id"]
                        self.set_status("on_call")
                        self.set_call(status="in_progress", conversation_id=conv_id, detail="")
                    continue
                data = await voice.get_conversation(conv_id)
                errors = 0
            except Exception as e:
                errors += 1
                if errors == 5:
                    self.set_call(detail=f"Lost contact with the voice agent ({e}). Use the manual outcome if needed.")
                continue

            lines = [t for t in data.get("transcript") or [] if t.get("message")]
            for t in lines[seen:]:
                ours = t.get("role") == "agent"
                self.message(
                    "customer_bot" if ours else "human_agent",
                    VOICE_LABEL if ours else CALLER_LABEL,
                    t["message"],
                    channel="call",
                )
            seen = len(lines)

            st = data.get("status")
            duration = int((data.get("metadata") or {}).get("call_duration_secs") or 0)
            mapped = {"initiated": "in_progress", "in-progress": "in_progress"}.get(st, st)
            if mapped in ("in_progress", "processing", "done", "failed") and (
                mapped != self.call_state.status or duration != self.call_state.duration_seconds
            ):
                self.set_call(status=mapped, duration_seconds=duration)
            if st == "done" and self.status not in FINISHED:
                amount, offer_type = await self._read_call_outcome([(t.get("role"), t["message"]) for t in lines])
                self.apply_call_outcome(amount, offer_type)
                return
            if st == "failed":
                self.set_call(detail="The call failed. Use the manual outcome.")
                return

    async def _read_call_outcome(self, lines: list[tuple[str, str]]):
        """Return (amount, offer_type) agreed on the call, or (0, "none"). Stub: last amount Counterbot agreed to."""
        for role, text in reversed(lines):
            if role == "agent" and re.search(r"\b(agree|agreed|accept|deal)\b", text, re.I):
                amount, offer_type = parse_offer(text)
                if amount:
                    return amount, offer_type
        return 0, "none"

    def apply_call_outcome(self, amount: int, offer_type: str):
        # Offers the caller made on the call, for the board.
        for m in [m for m in self.messages() if m.channel == "call" and m.sender == "human_agent"]:
            a, t = parse_offer(m.text)
            if a:
                self._emit("offer", offer=Offer(amount_gbp=a, offer_type=t))
        if offer_type == "none" or amount <= 0:
            self.resolved_on = "none"
            self.set_status("walked_away", detail="No deal on the call")
        else:
            self._finish_won(amount, "call", offer_type)

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
            resolved_on=self.resolved_on,
            call_duration_seconds=self.call_state.duration_seconds if self.call_state else 0,
        )
