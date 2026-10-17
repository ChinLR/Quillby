"""Test the reverse call: Counterbot phones the number in COUNTERBOT_TEST_TO (your .env).

Run from the repo root: .venv/bin/python backend/voice_call_test.py
Your phone will ring. The number must be a verified caller ID in Twilio while the account is a trial.
Prints no secrets.
"""

import asyncio
import os
import pathlib
import sys
import time

from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")
sys.path.insert(0, str(pathlib.Path(__file__).parent))

import voice  # noqa: E402


async def main() -> int:
    to = os.environ.get("COUNTERBOT_TEST_TO", "").strip()
    if not voice.configured():
        print("FAIL ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID missing in .env")
        return 1
    if not to.startswith("+"):
        print("FAIL set COUNTERBOT_TEST_TO in .env to your verified phone in international format, e.g. +447...")
        return 1
    since = int(time.time()) - 5
    print(f"Calling ...{to[-4:]} now. Pick up your phone.")
    try:
        res = await voice.start_outbound_call(
            to,
            prompt=(
                "You are Counterbot, an AI assistant. This is a short test call. Greet the person, ask them to say "
                "something, repeat back what you heard in one sentence, then say goodbye and end the call."
            ),
            first_message="Hi, this is Counterbot, a test call. Can you hear me clearly? Say something and I'll repeat it back.",
        )
    except Exception as e:
        print(f"FAIL could not start the call: {e}")
        return 1
    print(f"ElevenLabs says: success={res.get('success')} message={res.get('message')!r}")
    cid = res.get("conversation_id")
    if not res.get("success") or not cid:
        return 1
    print(f"conversation {cid[:12]}... waiting for the call to finish")
    last = None
    for _ in range(45):
        await asyncio.sleep(2)
        data = await voice.get_conversation(cid)
        st = data.get("status")
        if st != last:
            print(f"  status: {st}")
            last = st
        if st in ("done", "failed"):
            for t in data.get("transcript") or []:
                if t.get("message"):
                    print(f"  {t.get('role'):5} {t['message']}")
            md = data.get("metadata") or {}
            print(f"  duration: {md.get('call_duration_secs')}s  termination: {md.get('termination_reason') or (data.get('analysis') or {}).get('call_successful')}")
            return 0 if st == "done" else 1
    print("Timed out waiting for the call to finish.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
