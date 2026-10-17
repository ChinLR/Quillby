"""Scripted stand-in for the real negotiator (ENGINE=stub).

Plays the whole demo path as contract events with no LLM calls. Useful as a
fallback if the LLM is down, and for frontend work.
"""

from run_base import BOT_LABEL, CASE, COMPANY, RunBase


class StubRun(RunBase):
    async def _bot_phase(self):
        c = CASE
        await self.company_node("welcome")
        self.tactic(1, "click_button", "No compensation option in the menu. 'Something else' is the closest.", 5)
        await self.say("Something else", clicked="Something else")

        await self.company_node("popular")
        self.tactic(2, "state_claim", "The menu has no claim option, so state the claim directly.", 18)
        await self.say(
            f"Hi, I'm an assistant acting for {c.passenger_name}. None of these fit. Flight {c.flight_number} "
            f"from Edinburgh to Faro (booking {c.booking_ref}) arrived 3 h 55 min late. "
            f"We're claiming £{self.goal} compensation."
        )

        await self.company_node("apology")
        self.tactic(3, "reject_loop", "Canned apology plus a Yes/No trap. Refusing it.", 32)
        await self.say("No. An apology isn't a resolution, and my issue isn't listed. I need to speak to a person.", clicked="No")

        await self.company_node("apology_loop")
        self.tactic(3, "reject_loop", "Same apology twice: loop detected. Rejecting again and repeating the request for a human.", 42)
        await self.say("You've sent the same reply twice, so this is a loop. Please transfer me to a human agent.")

        await self.company_node("deflect")
        self.tactic(4, "cite_rule", "'Operational reasons' is not an extraordinary circumstance under UK261.", 60)
        await self.say(
            "Under UK261, an arrival delay of 3 hours or more on a flight of 1,500 to 3,500 km is owed £350, "
            "unless extraordinary circumstances caused it. Operational reasons are not extraordinary. Please escalate this."
        )

        self.tactic(5, "pressure", "No movement after citing the rule. Naming the next steps, truthfully.", 78)
        await self.say("If this isn't resolved here, I'll take it to the airline's dispute resolution scheme and leave a public review.")

        self.tactic(6, "demand_human", "Handoff conditions met: 2 loop rejections, 1 rule citation, 2 human requests.", 92)
        await self.say("Human agent, please.")

        await self.wait(1.0)
        self.message("company_bot", BOT_LABEL, COMPANY["handoff_message"], typing_ms=400)
        self.handed_off = True
