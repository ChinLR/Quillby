"""Turn the customer's own words into a Case.

Any complaint is accepted and classified; only flight delays are negotiated
in this demo. Facts the customer doesn't give fall back to the seeded case.
The mock company is always the fictional Northwind Air.
"""

import asyncio
import re
from datetime import datetime, timedelta

from pydantic import BaseModel, ValidationError

from models import Case, IntakeResult, Legal
from run_base import CASE

try:
    from llm import ask_json
except Exception:
    ask_json = None

COMPLAINT_TYPES = ["flight_delay", "flight_cancellation", "lost_baggage", "refund", "billing", "subscription", "other"]


class Extracted(BaseModel):
    complaint_type: str = "other"
    company: str = ""
    passenger_name: str = ""
    booking_ref: str = ""
    flight_number: str = ""
    origin: str = ""
    destination: str = ""
    delay_minutes: int = 0
    airline_reason: str = ""
    amount_gbp: int = 0


SYSTEM = (
    "You extract the facts of a customer complaint. Only use what the customer wrote; leave a field empty or 0 "
    "if it is not stated. complaint_type is one of: " + ", ".join(COMPLAINT_TYPES) + ". "
    "delay_minutes is the arrival delay in minutes (convert hours). amount_gbp is the amount the customer asks for, if any.\n"
    'Reply with JSON: {"complaint_type": "", "company": "", "passenger_name": "", "booking_ref": "", '
    '"flight_number": "", "origin": "", "destination": "", "delay_minutes": 0, "airline_reason": "", "amount_gbp": 0}'
)


def _fallback(description: str) -> Extracted:
    """Keyword guess when the LLM is unavailable."""
    low = description.lower()
    kind = "flight_delay" if re.search(r"\b(flight|plane|airline)\b", low) and "delay" in low else "other"
    hours = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b", low)
    amount = re.search(r"£\s?(\d+)", description)
    return Extracted(
        complaint_type=kind,
        delay_minutes=int(float(hours.group(1)) * 60) if hours else 0,
        amount_gbp=int(amount.group(1)) if amount else 0,
    )


async def _extract(description: str) -> Extracted:
    if ask_json is not None:
        try:
            out = await asyncio.wait_for(asyncio.to_thread(ask_json, SYSTEM, f"Complaint:\n{description}", 800), 15)
            e = Extracted(**out)
            if e.complaint_type not in COMPLAINT_TYPES:
                e.complaint_type = "other"
            return e
        except (ValidationError, Exception):
            pass
    return _fallback(description)


async def build_case(description: str, goal: int | None, floor: int | None) -> IntakeResult:
    e = await _extract(description)
    notes: list[str] = []
    supported = e.complaint_type == "flight_delay"

    if not supported:
        case = Case(
            id="intake",
            passenger_name=e.passenger_name or CASE.passenger_name,
            booking_ref=e.booking_ref,
            airline=e.company,
            flight_number="",
            origin="",
            destination="",
            scheduled_arrival="",
            actual_arrival="",
            delay_minutes=0,
            airline_reason="",
            goal_gbp=goal or e.amount_gbp or 0,
            floor_gbp=floor or 0,
            legal=Legal(title="", points=[], disclaimer=""),
            complaint_type=e.complaint_type,
            summary=description,
        )
        label = e.complaint_type.replace("_", " ")
        return IntakeResult(
            supported=False,
            note=f"Understood: a {label} complaint. This demo build negotiates flight delays only.",
            case=case,
        )

    s = CASE
    delay = e.delay_minutes or s.delay_minutes
    sched = datetime.fromisoformat(s.scheduled_arrival.replace("Z", "+00:00"))
    actual = (sched + timedelta(minutes=delay)).isoformat().replace("+00:00", "Z")
    goal = goal or e.amount_gbp or s.goal_gbp
    floor = floor if floor is not None else min(s.floor_gbp, goal)
    if e.company and "northwind" not in e.company.lower():
        notes.append("The demo airline is the fictional Northwind Air.")
    if delay < 180:
        notes.append("UK261 compensation usually needs an arrival delay of 3 hours or more.")
    missing = [n for n, v in (("flight", e.flight_number), ("booking", e.booking_ref)) if not v]
    if missing:
        notes.append(f"Using the demo {' and '.join(missing)} details where you didn't give them.")
    legal = s.legal
    new_route = any(
        v and v.lower().split(" (")[0] not in (s.origin + " " + s.destination).lower() for v in (e.origin, e.destination)
    )
    if new_route:
        # The seeded distance line is for Edinburgh to Faro only.
        legal = legal.model_copy(update={"points": [p for p in legal.points if "Edinburgh to Faro" not in p]})
        notes.append("Check the UK261 distance band for this route.")

    case = s.model_copy(
        update={
            "id": "intake",
            "passenger_name": e.passenger_name or s.passenger_name,
            "booking_ref": e.booking_ref or s.booking_ref,
            "flight_number": e.flight_number or s.flight_number,
            "origin": e.origin or s.origin,
            "destination": e.destination or s.destination,
            "delay_minutes": delay,
            "actual_arrival": actual,
            "airline_reason": e.airline_reason or s.airline_reason,
            "goal_gbp": goal,
            "floor_gbp": floor,
            "complaint_type": "flight_delay",
            "summary": description,
            "legal": legal,
        }
    )
    return IntakeResult(supported=True, note=" ".join(notes), case=case)
