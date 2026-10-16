import time, json, os
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
c = OpenAI(base_url=os.environ["LLM_BASE_URL"], api_key=os.environ["LLM_API_KEY"], timeout=120, max_retries=0)
new = ["deepseek-ai/DeepSeek-V4-Flash-0731","deepseek-ai/DeepSeek-V4-Pro","deepseek-ai/DeepSeek-V4-Pro-0813","Qwen/Qwen3.5-397B-A17B","Qwen/Qwen3.8-27B","moonshotai/Kimi-K2.7-Code","moonshotai/Kimi-K3","zai-org/GLM-5.1","zai-org/GLM-5.2","zai-org/GLM-5.3","nvidia/Nemotron-3-Ultra-550b-a55b","nvidia/nemotron-3-super-120b-a12b","nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B","MiniMaxAI/MiniMax-M3","NousResearch/Hermes-4-405B","meta-models/muse-spark-open","reflection/beam"]
retest = ["moonshotai/Kimi-K2.6","openai/gpt-oss-120b","nvidia/Nemotron-3_5-Lightning","zai-org/GLM-5.3-Flash"]
sys = "You are a travel planner. Reply with JSON only."
usr = 'Plan a one-day Edinburgh itinerary for a student on a budget. Return {"title": "string", "total_cost_gbp": 0, "stops": ["string"], "tip": "string"}'
def run(m):
    t=time.time()
    try:
        r = c.chat.completions.create(model=m, max_tokens=3000, temperature=0.3, response_format={"type":"json_object"}, messages=[{"role":"system","content":sys},{"role":"user","content":usr}])
        ch = r.choices[0]; txt = ch.message.content or ""
        try:
            d = json.loads(txt[txt.find("{"):txt.rfind("}")+1]); ok = all(k in d for k in ["title","total_cost_gbp","stops","tip"])
        except Exception: ok = False
        return (m, round(time.time()-t,1), "valid" if ok else "BAD", ch.finish_reason, r.usage.completion_tokens if r.usage else None, "")
    except Exception as e:
        return (m, round(time.time()-t,1), "ERR", "", None, str(e)[:100])
with ThreadPoolExecutor(5) as ex:
    res = list(ex.map(run, new+retest))
for r in sorted(res, key=lambda x:(x[2]!="valid", x[1])): print(r)
