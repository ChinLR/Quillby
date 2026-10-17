import asyncio
import os
import pathlib

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

import intake
from models import (
    AutoAgentBody,
    AutoAgentResponse,
    CallOutcomeBody,
    CallState,
    Case,
    HealthResponse,
    History,
    Inbox,
    IntakeRequest,
    IntakeResult,
    Message,
    NegotiationState,
    OkResponse,
    Report,
    StartRequest,
    TextBody,
)
load_dotenv()  # ENGINE and REPLAY_MODE can live in .env

from run_base import CALL_PHASE, CASE, FINISHED, LADDER

# ENGINE=stub plays the scripted run with no LLM calls (fallback for the demo).
if os.environ.get("ENGINE", "real") == "stub":
    from stub_engine import StubRun as Run
else:
    from engine import Run

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# One active negotiation at a time (see .plans/contract.md).
current: Run | None = None
counter = 0
# The case the next negotiation fights for: the seeded demo case, or the last intake.
current_case: Case = CASE
current_supported = True


def get_run(nid: str) -> Run:
    if current is None or current.id != nid:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    return current


def get_current() -> Run:
    if current is None:
        raise HTTPException(status_code=404, detail="No active negotiation")
    return current


def stop_current():
    global current
    if current and current.task:
        current.task.cancel()
    current = None


def check_not_finished(run: Run):
    if run.status in FINISHED:
        raise HTTPException(status_code=409, detail="Negotiation already finished")


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(ok=True, replay_mode=os.environ.get("REPLAY_MODE") == "1")


@app.get("/api/case", response_model=Case)
def get_case():
    return current_case


@app.post("/api/intake", response_model=IntakeResult)
async def post_intake(body: IntakeRequest):
    global current_case, current_supported
    if body.goal_gbp is not None and body.floor_gbp is not None and body.floor_gbp > body.goal_gbp:
        raise HTTPException(status_code=422, detail="Floor cannot be above the goal")
    result = await intake.build_case(body.description, body.goal_gbp, body.floor_gbp)
    current_case, current_supported = result.case, result.supported
    return result


@app.post("/api/negotiations", response_model=NegotiationState)
async def start_negotiation(body: StartRequest | None = None):
    global current, counter
    body = body or StartRequest()
    if not current_supported:
        raise HTTPException(status_code=409, detail="This demo negotiates flight delays only")
    goal = body.goal_gbp if body.goal_gbp is not None else current_case.goal_gbp
    floor = body.floor_gbp if body.floor_gbp is not None else current_case.floor_gbp
    if floor > goal:
        raise HTTPException(status_code=422, detail="Floor cannot be above the goal")
    stop_current()
    counter += 1
    current = Run(f"n{counter}", current_case, goal, floor, body.speed)
    current.task = asyncio.create_task(current.run())
    return current.state()


@app.get("/api/negotiations/{nid}", response_model=NegotiationState)
def get_negotiation(nid: str):
    return get_run(nid).state()


@app.get("/api/negotiations/{nid}/events", response_class=StreamingResponse)
async def stream_events(nid: str, request: Request, after: int = 0):
    """Server-sent events. Each event is an EventEnvelope; see /history for the typed shape."""
    run = get_run(nid)

    async def gen():
        sent, idle = max(after, 0), 0.0
        while not await request.is_disconnected():
            while sent < len(run.events):
                ev = run.events[sent]
                sent += 1
                yield f"id: {ev.seq}\ndata: {ev.model_dump_json()}\n\n"
                idle = 0.0
            await asyncio.sleep(0.2)
            idle += 0.2
            if idle >= 15:
                yield ": ping\n\n"
                idle = 0.0

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/negotiations/{nid}/history", response_model=History)
def get_history(nid: str, after: int = 0):
    run = get_run(nid)
    events = run.events[max(after, 0):]
    return History(events=events, last_seq=len(run.events))


@app.post("/api/negotiations/{nid}/pause", response_model=NegotiationState)
def pause(nid: str):
    run = get_run(nid)
    check_not_finished(run)
    if run.status in CALL_PHASE:
        raise HTTPException(status_code=409, detail="Can't pause during the call phase")
    if not run.paused:
        run.pause()
    return run.state()


@app.post("/api/negotiations/{nid}/resume", response_model=NegotiationState)
def resume(nid: str):
    run = get_run(nid)
    check_not_finished(run)
    if run.status in CALL_PHASE:
        raise HTTPException(status_code=409, detail="Can't resume during the call phase")
    if run.paused:
        run.resume()
    return run.state()


@app.post("/api/negotiations/{nid}/message", response_model=Message)
def customer_message(nid: str, body: TextBody):
    run = get_run(nid)
    if not run.paused:
        raise HTTPException(status_code=409, detail="Pause the negotiation first")
    return run.message("customer", run.customer_label, body.text)


@app.get("/api/negotiations/{nid}/report", response_model=Report)
def get_report(nid: str):
    run = get_run(nid)
    if run.status not in FINISHED:
        raise HTTPException(status_code=409, detail="Negotiation not finished")
    return run.report()


@app.get("/api/negotiations/{nid}/call", response_model=CallState)
def get_call(nid: str):
    run = get_run(nid)
    if run.call_state is None:
        raise HTTPException(status_code=409, detail="No call yet")
    return run.call_state


@app.post("/api/negotiations/{nid}/call/outcome", response_model=NegotiationState)
def post_call_outcome(nid: str, body: CallOutcomeBody):
    run = get_run(nid)
    if run.status not in CALL_PHASE:
        raise HTTPException(status_code=409, detail="Not in the call phase")
    run.apply_call_outcome(body.amount_gbp, body.offer_type)
    return run.state()


@app.post("/api/reset", response_model=OkResponse)
def reset():
    global current_case, current_supported
    stop_current()
    current_case, current_supported = CASE, True
    return OkResponse(ok=True)


# Human-agent window: always the current negotiation.


@app.get("/api/company/inbox", response_model=Inbox)
def inbox():
    run = get_current()
    return Inbox(
        handed_off=run.handed_off,
        auto_agent=run.auto_agent,
        messages=run.messages(),
        cheat_sheet=LADDER,
        call_number=run.call_number if run.call_requested else "",
    )


@app.post("/api/company/reply", response_model=Message)
def agent_reply(body: TextBody):
    run = get_current()
    if not run.handed_off:
        raise HTTPException(status_code=409, detail="Not handed off yet")
    check_not_finished(run)
    if run.status in CALL_PHASE:
        raise HTTPException(status_code=409, detail="The chat is over: continue on the call")
    return run.post_agent_reply(body.text)


@app.post("/api/company/auto-agent", response_model=AutoAgentResponse)
def set_auto_agent(body: AutoAgentBody):
    run = get_current()
    run.auto_agent = body.enabled
    return AutoAgentResponse(auto_agent=run.auto_agent)


# The fake airline website (see .plans/airline-site-spec.md): open http://localhost:8000/northwind/
_SITE = pathlib.Path(__file__).parent.parent / "airline-site"
if _SITE.is_dir():
    app.mount("/northwind", StaticFiles(directory=_SITE, html=True), name="northwind")
