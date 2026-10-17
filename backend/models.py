from typing import Literal, Optional

from pydantic import BaseModel, Field

Sender = Literal["customer_bot", "company_bot", "human_agent", "customer", "system"]
Status = Literal["running", "paused", "won", "walked_away", "failed"]
OfferType = Literal["voucher", "cash"]
EventType = Literal["message", "tactic", "detection", "offer", "status"]


class Legal(BaseModel):
    title: str
    points: list[str]
    disclaimer: str


class Case(BaseModel):
    id: str
    passenger_name: str
    booking_ref: str
    airline: str
    flight_number: str
    origin: str
    destination: str
    scheduled_arrival: str
    actual_arrival: str
    delay_minutes: int
    airline_reason: str
    goal_gbp: int
    floor_gbp: int
    legal: Legal


class Message(BaseModel):
    id: str
    sender: Sender
    sender_label: str
    text: str
    buttons: list[str] = []
    clicked_button: Optional[str] = None
    typing_ms: int = 0
    created_at: str


class Tactic(BaseModel):
    stage: int
    stage_name: str
    move: str
    reason: str
    pressure: int


class Detection(BaseModel):
    is_human: bool
    confidence: int
    signals: list[str] = []


class Offer(BaseModel):
    amount_gbp: int
    offer_type: OfferType
    accepted: bool = False


class StatusUpdate(BaseModel):
    status: Status
    human_reached: bool
    detail: str = ""


class EventEnvelope(BaseModel):
    seq: int
    type: EventType
    message: Optional[Message] = None
    tactic: Optional[Tactic] = None
    detection: Optional[Detection] = None
    offer: Optional[Offer] = None
    status: Optional[StatusUpdate] = None


class NegotiationState(BaseModel):
    id: str
    status: Status
    human_reached: bool
    stage: int
    pressure: int
    best_offer_gbp: Optional[int] = None
    goal_gbp: int
    floor_gbp: int
    started_at: str


class Report(BaseModel):
    outcome: Literal["won", "walked_away", "failed"]
    amount_gbp: int
    offer_type: Literal["voucher", "cash", "none"]
    goal_gbp: int
    floor_gbp: int
    duration_seconds: int
    bot_message_count: int
    estimated_minutes_saved: int
    stages_reached: list[str]
    transcript: list[Message]


class ConcessionStep(BaseModel):
    step: int
    offer_type: OfferType
    amount_gbp: int
    condition: str


# Request and small response bodies


class StartRequest(BaseModel):
    goal_gbp: Optional[int] = None
    floor_gbp: Optional[int] = None
    speed: float = Field(1.0, ge=0.5, le=3.0)


class TextBody(BaseModel):
    text: str = Field(min_length=1)


class AutoAgentBody(BaseModel):
    enabled: bool


class AutoAgentResponse(BaseModel):
    auto_agent: bool


class OkResponse(BaseModel):
    ok: bool


class HealthResponse(BaseModel):
    ok: bool
    replay_mode: bool


class History(BaseModel):
    events: list[EventEnvelope]
    last_seq: int


class Inbox(BaseModel):
    handed_off: bool
    auto_agent: bool
    messages: list[Message]
    cheat_sheet: list[ConcessionStep]
