"""The real negotiator (ENGINE=real, the default).

The engine decides which moves are allowed at each point, so the escalation
ladder always advances. The LLM picks one allowed move and writes the
message and the board's reason. Every LLM answer is validated; on any
failure the engine uses a template line, so a run never stalls.
"""

import asyncio
import re
import statistics

from pydantic import BaseModel, ValidationError

from company import HUMAN_RE, REJECT_RE, RULE_RE, MockCompany
from models import Detection
from run_base import BOT_LABEL, CASE, COMPANY, NODES, RunBase, parse_offer

try:
    from llm import ask_json
except Exception:  # missing .env etc.: run on templates only
    ask_json = None

LLM_TIMEOUT_S = 15
MAX_BOT_TURNS = 12
STAGE_PRESSURE = {1: 5, 2: 18, 3: 32, 4: 55, 5: 75, 6: 88}
LOOP_NODES = {"welcome", "popular", "apology", "apology_loop"}
CANNED = [p.lower() for p in COMPANY["canned_phrases"]]

MOVE_HELP = {
    "click_button": "Click the button that gets closest to a compensation claim. message must be the exact button label.",
    "state_claim": "Introduce yourself as an assistant acting for the passenger, then state the facts and the claim amount.",
    "reject_loop": "Refuse the canned reply or Yes/No trap. Say the issue is not listed and ask for a person.",
    "cite_rule": "Cite UK261 by name and explain why 'operational reasons' does not remove the right to compensation.",
    "pressure": "Name truthful next steps: the airline's dispute resolution scheme and a public review. Ask for a human.",
    "demand_human": "Firmly ask to be transferred to a human agent.",
    "hold_firm": "Refuse the offer politely and restate what is owed in cash.",
    "counter": "Say the offer is close and ask for the full amount.",
    "accept_offer": "Accept the cash offer and ask for written confirmation.",
    "walk_away": "Decline and say you will take it to the dispute resolution scheme.",
}

# Template lines used when the LLM is unavailable or its answer fails a check.
TEMPLATES = {
    "state_claim": (
        "Hi, I'm an assistant acting for {name}. None of these fit. Flight {flight} from Edinburgh to Faro "
        "(booking {ref}) arrived 3 h 55 min late. We're claiming £{goal} compensation."
    ),
    "reject_loop": "No. An apology isn't a resolution, and my issue isn't listed. I need to speak to a person.",
    "cite_rule": (
        "Under UK261, an arrival delay of 3 hours or more on a flight of 1,500 to 3,500 km is owed £{goal}, "
        "unless extraordinary circumstances caused it. Operational reasons are not extraordinary. Please escalate this."
    ),
    "pressure": "If this isn't resolved here, I'll take it to the airline's dispute resolution scheme and leave a public review. Please pass me to a person.",
    "demand_human": "Human agent, please.",
}

# Board reasons for template lines, so a fallback still reads well on stage.
TEMPLATE_REASONS = {
    "click_button": "No compensation option. Picking the closest button.",
    "state_claim": "Stating the facts and the claim amount.",
    "reject_loop": "Canned reply. Refusing the loop and asking for a person.",
    "cite_rule": "Rebutting 'operational reasons' with UK261.",
    "pressure": "Naming the truthful next steps.",
    "demand_human": "Insisting on a human agent.",
}


class TacticStep(BaseModel):
    stage: int = 0
    move: str
    reason: str
    message: str
    clicked_button: str = ""


class OfferParse(BaseModel):
    offer_gbp: int = 0
    offer_type: str = "none"
    accepts_claim: bool = False


def _system_prompt(goal: int, floor: int) -> str:
    c = CASE
    rules = "\n".join(f"- {p}" for p in c.legal.points)
    return (
        "You are Counterbot, an AI assistant negotiating on behalf of an airline passenger in the airline's support chat.\n"
        "Honesty rules: use only the facts below, never invent evidence or events, never claim to be a human. "
        "If asked, say you are an assistant acting for the passenger.\n"
        "Style: firm, polite, natural, like a determined person. At most 2 short sentences, under 35 words. No emojis.\n\n"
        f"Passenger: {c.passenger_name}. Booking {c.booking_ref}. Flight {c.flight_number}, {c.origin} to {c.destination}.\n"
        f"Scheduled arrival {c.scheduled_arrival}, actual arrival {c.actual_arrival}: {c.delay_minutes} minutes late.\n"
        f"Airline's stated reason: {c.airline_reason}.\n"
        f"Goal: £{goal} in cash. Never accept less than £{floor} in cash. Never accept vouchers.\n"
        "Your minimum is private: never state it, hint at it, or mention any amount other than the goal or the offer on the table.\n\n"
        f"Rules you may cite ({c.legal.title}):\n{rules}\n\n"
        'Reply with JSON: {"stage": 0, "move": "one of the allowed moves", '
        '"reason": "why this move, under 15 words, for a live tactic board", '
        '"message": "exactly what you send", "clicked_button": "exact button label if move is click_button, else empty"}'
    )


class Run(RunBase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.company = MockCompany()
        # What our side knows: only its own moves, never the mock's counters.
        self.claim_stated = False
        self.rejections = 0
        self.rule_citations = 0
        self.pressure_used = False
        self.disclosed = False
        self.handoff_seen = False
        self._company_latencies: list[float] = []
        self._fallback_i = 0
        self.system = _system_prompt(self.goal, self.floor)

    # LLM plumbing

    async def _ask(self, user: str) -> dict | None:
        if ask_json is None:
            return None
        try:
            return await asyncio.wait_for(asyncio.to_thread(ask_json, self.system, user), LLM_TIMEOUT_S)
        except Exception:
            return None

    def _transcript(self, limit: int = 12) -> str:
        lines = []
        for m in self.messages()[-limit:]:
            if m.sender == "customer_bot":
                who = "You"
            elif m.sender == "customer":
                who = "Passenger (instruction to you)"
            elif m.sender in ("company_bot", "human_agent"):
                who = "Company (human agent)" if self.human_reached else "Company"
            else:
                continue
            extra = f"  [buttons: {', '.join(m.buttons)}]" if m.buttons else ""
            click = f"  [clicked: {m.clicked_button}]" if m.clicked_button else ""
            lines.append(f"{who}: {m.text}{extra}{click}")
        return "\n".join(lines)

    # planning (bot phase)

    def _plan(self, node_id: str) -> tuple[int, list[str]]:
        if node_id == "welcome" and not self.claim_stated and NODES[node_id]["buttons"]:
            return 1, ["click_button"]
        if not self.claim_stated:
            return 2, ["state_claim"]
        if node_id == "deflect" and self.rule_citations < 1:
            return 4, ["cite_rule"]
        if node_id in LOOP_NODES and self.rejections < 2:
            return 3, ["reject_loop", "demand_human"]
        if self.rule_citations < 1:
            return 4, ["cite_rule"]
        if not self.pressure_used:
            return 5, ["pressure", "demand_human"]
        return 6, ["demand_human"]

    def _template(self, move: str) -> str:
        c = CASE
        return TEMPLATES[move].format(name=c.passenger_name, flight=c.flight_number, ref=c.booking_ref, goal=self.goal)

    def _guard(self, move: str, text: str, buttons: list[str], clicked: str) -> tuple[str, str | None]:
        """Make sure the message does what the move claims, so the conversation really advances."""
        if move == "click_button":
            if clicked not in buttons:
                clicked = next((b for b in buttons if "else" in b.lower()), buttons[-1])
            return clicked, clicked
        if not self.disclosed and not re.search(r"\bassistant\b", text, re.I):
            text = f"I'm an assistant acting for {CASE.passenger_name}. {text}"
        if move == "reject_loop" and not REJECT_RE.search(text):
            text += " My issue isn't listed."
        if move in ("reject_loop", "pressure", "demand_human") and not HUMAN_RE.search(text):
            text += " Please transfer me to a human agent."
        if move == "cite_rule" and not RULE_RE.search(text):
            text += " This is covered by UK261."
        if self._leaks_floor(text):
            text = self._template(move)
        return text, None

    def _leaks_floor(self, text: str) -> bool:
        return self.floor != self.goal and re.search(rf"£\s?{self.floor}\b", text) is not None

    async def _bot_turn(self, node_id: str):
        stage, allowed = self._plan(node_id)
        buttons = NODES[node_id]["buttons"] and [b["label"] for b in NODES[node_id]["buttons"]]
        user = (
            f"Conversation so far:\n{self._transcript()}\n\n"
            f"Current stage: {stage} of 6. Allowed moves:\n"
            + "\n".join(f"- {m}: {MOVE_HELP[m]}" for m in allowed)
            + "\n\nPick one allowed move and write the message."
        )
        out = await self._ask(user)
        step = None
        if out is not None:
            try:
                step = TacticStep(**out)
            except ValidationError:
                step = None
        if step and step.move in allowed and step.message.strip():
            move, reason, text, clicked = step.move, step.reason.strip(), step.message.strip(), step.clicked_button
        else:
            move = allowed[0]
            reason = TEMPLATE_REASONS[move]
            print(f"[engine] template fallback for {move}", flush=True)
            clicked = ""
            text = "" if move == "click_button" else self._template(move)
        text, clicked_btn = self._guard(move, text, buttons or [], clicked)
        return stage, move, reason, text, clicked_btn

    def _record(self, move: str, text: str):
        if move != "click_button":
            self.disclosed = self.disclosed or bool(re.search(r"\bassistant\b", text, re.I))
        if move == "state_claim":
            self.claim_stated = True
        if move == "reject_loop":
            self.rejections += 1
        if move == "cite_rule":
            self.rule_citations += 1
        if move == "pressure":
            self.pressure_used = True

    async def _bot_phase(self):
        node = "welcome"
        await self.company_node(node)
        turns = 0
        while True:
            turns += 1
            if turns > MAX_BOT_TURNS:
                # Safety net: the seeded fallback lines meet every handoff condition.
                stage, move, reason = 6, "demand_human", "Too many turns. Using the fallback line."
                text, clicked = COMPANY["fallback_lines"][self._fallback_i % len(COMPANY["fallback_lines"])], None
                self._fallback_i += 1
            else:
                stage, move, reason, text, clicked = await self._bot_turn(node)
            pressure = min(100, max(self.pressure + 6, STAGE_PRESSURE[stage]))
            self.tactic(stage, move, reason, pressure)
            await self.say(text, clicked=clicked)
            self._record(move, text)

            node = self.company.respond(text, clicked)
            if node == "handoff":
                await self.wait(1.0)
                self.message("company_bot", BOT_LABEL, COMPANY["handoff_message"], typing_ms=400)
                self.handoff_seen = True
                self.handed_off = True
                return
            await self.company_node(node)
            if self.last_latency is not None:
                self._company_latencies.append(self.last_latency)
            if stage >= 3:
                self.detection(await self._detect(NODES[node]["text"], after_handoff=False))

    # detection from signals

    async def _detect(self, text: str, after_handoff: bool) -> Detection:
        signals, score = [], 0
        base = statistics.median(self._company_latencies) if self._company_latencies else None
        lat = self.last_latency
        if base and lat and lat > 2 * base:
            signals.append(f"slower reply ({lat:.1f}s vs {base:.1f}s)")
            score += 25
        low = text.lower()
        if not any(p in low for p in CANNED):
            signals.append("not a canned phrase")
            score += 25
        if after_handoff and self.handoff_seen:
            signals.append("handoff announced")
            score += 35
        if re.search(r"\b(this is|i'm|i am|my name is)\s+[A-Z][a-z]+", text):
            signals.append("introduced by name")
            score += 15
        if re.search(r"\b(ok|okay|fine|honestly|let me|to be fair|fair point)\b", low) or "..." in text:
            signals.append("informal wording")
            score += 10
        confidence = min(score, 99)
        return Detection(is_human=confidence >= 60, confidence=confidence, signals=signals)

    # human phase: the policy is deterministic (run_base.decide); the LLM words it

    async def _parse_offer(self, text: str):
        amount, offer_type = parse_offer(text)
        if amount is not None or not re.search(r"\d|hundred|fifty|twenty", text, re.I):
            return amount, offer_type
        out = await self._ask(
            "Read this message from the airline's agent and extract any compensation offer.\n"
            f"Message: {text}\n"
            'Reply with JSON: {"offer_gbp": 0, "offer_type": "voucher|cash|none", "accepts_claim": false}'
        )
        try:
            p = OfferParse(**(out or {}))
        except ValidationError:
            return None, None
        if p.offer_gbp > 0 and p.offer_type in ("voucher", "cash"):
            return p.offer_gbp, p.offer_type
        return None, None

    async def _word(self, move, reason, template, context):
        amount = context["amount"]
        user = (
            f"Conversation so far:\n{self._transcript()}\n\n"
            f"The agent just said: {context['agent_text']}\n"
            f"Your decision is fixed: {move}. {MOVE_HELP[move]}\n"
            f"Decision reason: {reason}\n"
            f"Offer on the table: {'£' + str(amount) + ' ' + context['offer_type'] if amount is not None else 'none'}.\n"
            f"Write the message for this decision. Use exact amounts with a £ sign. Allowed moves:\n- {move}: {MOVE_HELP[move]}"
        )
        out = await self._ask(user)
        try:
            step = TacticStep(**(out or {}))
        except ValidationError:
            return template, reason
        text = step.message.strip()
        if step.move != move or not text:
            return template, reason
        # Amount checks: the wording must match the decision exactly.
        if move == "accept_offer" and f"£{amount}" not in text:
            return template, reason
        if move in ("counter", "hold_firm") and f"£{self.goal}" not in text:
            return template, reason
        if re.search(r"\b(i am|i'm) (a )?(human|person)\b", text, re.I):
            return template, reason
        if self._leaks_floor(text) and amount != self.floor:
            return template, reason
        return text, (step.reason.strip() or reason)
