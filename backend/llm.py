import os, json, hashlib, pathlib
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(
    base_url=os.environ["LLM_BASE_URL"], api_key=os.environ["LLM_API_KEY"], timeout=20, max_retries=0
)
MODEL = os.environ["LLM_MODEL"]
CACHE = pathlib.Path(__file__).parent / "cache"
CACHE.mkdir(exist_ok=True)
REPLAY_MODE = os.environ.get("REPLAY_MODE") == "1"  # serve only cached responses

def ask_json(system: str, user: str, max_tokens: int = 3000) -> dict:
    key = CACHE / (hashlib.md5((MODEL + system + user).encode()).hexdigest() + ".json")
    if key.exists():
        return json.loads(key.read_text())
    if REPLAY_MODE:
        raise LookupError("Cache miss in replay mode")
    for _ in range(2):  # one retry on bad JSON
        r = client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=0.3,
            response_format={"type": "json_object"},  # remove if the model rejects it
            messages=[
                {"role": "system", "content": system + "\nReply with JSON only."},
                {"role": "user", "content": user},
            ],
        )
        text = r.choices[0].message.content
        try:
            out = json.loads(text[text.find("{"): text.rfind("}") + 1])
            key.write_text(json.dumps(out))
            return out
        except Exception:
            continue
    raise ValueError("LLM returned invalid JSON")
