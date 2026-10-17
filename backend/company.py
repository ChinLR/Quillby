"""The fictional airline's deliberately annoying support bot.

Deterministic, so the handoff fires on every run. It only sees what a real
support bot would: the customer's text and which button was clicked.
"""

import re

from run_base import COMPANY, NODES

HUMAN_RE = re.compile(r"\b(human|agent|person|representative|colleague|someone real|real person)\b", re.I)
RULE_RE = re.compile(r"\b(uk\s?261|regulation|261)\b", re.I)
REJECT_RE = re.compile(
    r"(not listed|isn.t listed|loop|same reply|same canned|not a resolution|isn.t a resolution|doesn.t help|didn.t help|not helpful"
    r"|none of (these|your|the) (options|topics|buttons)|doesn.t cover|don.t cover|won.t answer|doesn.t address|not an answer)",
    re.I,
)

# Free-text replies cycle through these, which is what makes it a loop.
FREE_TEXT_CYCLE = ["apology", "apology_loop", "deflect"]


class MockCompany:
    def __init__(self):
        self.node = "welcome"
        self.loop_rejections = 0
        self.rule_citations = 0
        self.human_requests = 0
        self.handed_off = False
        self._free_turns = 0
        self._rules = COMPANY["handoff"]

    def _count(self, text: str, clicked: str | None):
        if (clicked or "").lower() == "no" or REJECT_RE.search(text):
            self.loop_rejections += 1
        # A citation only counts as a rebuttal of the refusal, not as a mention in passing.
        if RULE_RE.search(text) and self.node == "deflect":
            self.rule_citations += 1
        if HUMAN_RE.search(text):
            self.human_requests += 1

    def ready_to_hand_off(self) -> bool:
        r = self._rules
        return (
            self.loop_rejections >= r["min_loop_rejections"]
            and self.rule_citations >= r["min_rule_citations"]
            and self.human_requests >= r["min_human_requests"]
        )

    def respond(self, text: str, clicked: str | None) -> str:
        """Return the next node id, or "handoff"."""
        self._count(text, clicked)
        if self.ready_to_hand_off():
            self.handed_off = True
            return "handoff"
        if clicked:
            nxt = next((b["next"] for b in NODES[self.node]["buttons"] if b["label"] == clicked), None)
            self.node = nxt if nxt in NODES else "popular"
        else:
            self.node = FREE_TEXT_CYCLE[self._free_turns % len(FREE_TEXT_CYCLE)]
            self._free_turns += 1
        return self.node
