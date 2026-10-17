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


VISION_MODEL = os.environ.get("VISION_MODEL", "Qwen/Qwen3.8-27B")

def read_image(data: bytes, mime: str, prompt: str, max_tokens: int = 1500) -> str:
    """Ask the vision model about an image. Cached on disk like ask_json (key = image bytes + prompt)."""
    import base64
    key = CACHE / ("img-" + hashlib.md5(VISION_MODEL.encode() + data + prompt.encode()).hexdigest() + ".txt")
    if key.exists():
        return key.read_text()
    if REPLAY_MODE:
        raise LookupError("Cache miss in replay mode")
    b64 = base64.b64encode(data).decode()
    r = client.chat.completions.create(
        model=VISION_MODEL,
        max_tokens=max_tokens,
        temperature=0,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{mime or 'image/png'};base64,{b64}"}},
        ]}],
    )
    text = (r.choices[0].message.content or "").strip()
    import re
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    if "<think>" in text:  # reasoning ran out of tokens before the answer
        raise ValueError("The vision model did not finish")
    key.write_text(text)
    return text
