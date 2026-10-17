"""Check the ElevenLabs voice setup. Run from the repo root: .venv/bin/python backend/voice_check.py

Checks the API key, the agent, and which phone number is assigned to it.
Prints no secrets.
"""

import asyncio
import os
import pathlib
import sys

from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")
sys.path.insert(0, str(pathlib.Path(__file__).parent))

import httpx  # noqa: E402

import voice  # noqa: E402


async def main() -> int:
    if not os.environ.get("ELEVENLABS_API_KEY"):
        print("FAIL ELEVENLABS_API_KEY is not set in .env")
        return 1
    if not os.environ.get("ELEVENLABS_AGENT_ID"):
        print("FAIL ELEVENLABS_AGENT_ID is not set in .env (create the agent in the ElevenLabs dashboard first)")
        return 1
    async with voice._client() as c:
        r = await c.get(f"{voice.API}/agents/{os.environ['ELEVENLABS_AGENT_ID']}")
        if r.status_code == 401:
            print("FAIL the API key was rejected (401)")
            return 1
        if r.status_code == 404:
            print("FAIL no agent with that ELEVENLABS_AGENT_ID (404)")
            return 1
        r.raise_for_status()
        print(f"OK   agent found: {r.json().get('name', '(unnamed)')}")

        r = await c.get(f"{voice.API}/phone-numbers")
        r.raise_for_status()
        data = r.json()
        numbers = data if isinstance(data, list) else data.get("phone_numbers", [])
    mine = [n for n in numbers if (n.get("assigned_agent") or {}).get("agent_id") == os.environ["ELEVENLABS_AGENT_ID"]]
    print(f"OK   {len(numbers)} phone number(s) in the account")
    if not mine:
        print("FAIL no phone number is assigned to this agent. In ElevenLabs: Phone numbers > import the Twilio number > assign this agent.")
        return 1
    for n in mine:
        print(f"OK   {n.get('phone_number')} ({n.get('provider')}) is assigned to the agent")
    try:
        print(f"OK   the backend will tell the airline to call: {await voice.phone_number()}")
    except httpx.HTTPError as e:
        print(f"FAIL phone number lookup: {e}")
        return 1
    print("Ready. Next: a test call to that number; the agent should answer with its first message.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
