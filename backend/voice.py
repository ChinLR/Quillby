"""ElevenLabs voice agent: Counterbot answers the airline's call on its Twilio number.

The only module that talks to ElevenLabs. Needs ELEVENLABS_API_KEY and
ELEVENLABS_AGENT_ID in .env; COUNTERBOT_PHONE_NUMBER is optional (otherwise
the number assigned to the agent is looked up). If they are missing, the
call phase waits for the manual outcome endpoint instead.
"""

import os

import httpx

API = "https://api.elevenlabs.io/v1/convai"
TIMEOUT = 10


def configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY") and os.environ.get("ELEVENLABS_AGENT_ID"))


def _agent_id() -> str:
    return os.environ["ELEVENLABS_AGENT_ID"]


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}, timeout=TIMEOUT)


async def phone_number() -> str:
    """The number the airline's agent should dial, or "" if unknown."""
    if os.environ.get("COUNTERBOT_PHONE_NUMBER"):
        return os.environ["COUNTERBOT_PHONE_NUMBER"]
    if not configured():
        return ""
    async with _client() as c:
        r = await c.get(f"{API}/phone-numbers", params={"agent_id": _agent_id()})
        r.raise_for_status()
        data = r.json()
    items = data if isinstance(data, list) else data.get("phone_numbers", [])
    for n in items:
        if (n.get("assigned_agent") or {}).get("agent_id") == _agent_id():
            return n.get("phone_number", "")
    return ""


async def prepare_agent(prompt: str, first_message: str):
    """Load this run's case, chat summary and rules into the agent before the call."""
    body = {"conversation_config": {"agent": {"first_message": first_message, "prompt": {"prompt": prompt}}}}
    async with _client() as c:
        r = await c.patch(f"{API}/agents/{_agent_id()}", json=body)
        r.raise_for_status()


async def find_conversation(since_unix: int) -> dict | None:
    """The newest conversation for the agent that started after since_unix, if any."""
    params = {"agent_id": _agent_id(), "call_start_after_unix": since_unix, "page_size": 5}
    async with _client() as c:
        r = await c.get(f"{API}/conversations", params=params)
        r.raise_for_status()
        convs = r.json().get("conversations", [])
    return convs[0] if convs else None


async def get_conversation(conversation_id: str) -> dict:
    async with _client() as c:
        r = await c.get(f"{API}/conversations/{conversation_id}")
        r.raise_for_status()
        return r.json()


async def phone_number_id() -> str:
    """ElevenLabs' id for the Twilio number assigned to the agent ("" if none)."""
    async with _client() as c:
        r = await c.get(f"{API}/phone-numbers", params={"agent_id": _agent_id()})
        r.raise_for_status()
        data = r.json()
    items = data if isinstance(data, list) else data.get("phone_numbers", [])
    for n in items:
        if (n.get("assigned_agent") or {}).get("agent_id") == _agent_id():
            return n.get("phone_number_id", "")
    return ""


async def start_outbound_call(to_number: str, prompt: str | None = None, first_message: str | None = None) -> dict:
    """Make the agent phone to_number from its Twilio number. Returns ElevenLabs' response."""
    body = {"agent_id": _agent_id(), "agent_phone_number_id": await phone_number_id(), "to_number": to_number}
    agent: dict = {}
    if first_message:
        agent["first_message"] = first_message
    if prompt:
        agent["prompt"] = {"prompt": prompt}
    if agent:
        body["conversation_initiation_client_data"] = {"conversation_config_override": {"agent": agent}}
    async with _client() as c:
        r = await c.post(f"{API}/twilio/outbound-call", json=body)
        if r.status_code >= 400:
            raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
        return r.json()
