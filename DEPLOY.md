# Deploying: Vercel (frontend) + Render (backend)

The frontend is a static React app, so it goes on **Vercel**. The backend is a long-running Python process (it keeps the live negotiation in memory and runs it as a background task), so it goes on **Render**. Vercel forwards `/api` and `/northwind` to Render, so the app needs no code changes.

```
Browser ──► Vercel (React app, static)
                │  rewrites: /api/*  and  /northwind/*
                ▼
            Render (FastAPI) ──► Nebius (LLM)
```

The hosted version is the **public mode**: live LLM calls, **no phone call** (the deal is settled in the chat), and rate limits so a shared link can't burn your credit. The live phone call is for the local demo only.

## 1. Deploy the backend on Render

1. Push this repo to GitHub (it already is).
2. In Render: **New > Blueprint**, connect GitHub, pick this repo. Render reads `render.yaml`.
3. When asked for **LLM_API_KEY**, paste your Nebius key. (It goes into Render, never into git.)
4. Create the service and wait for the first deploy.
5. Open `https://<your-service>.onrender.com/api/health`. You should see `{"ok":true,"replay_mode":false}`.
6. Open `https://<your-service>.onrender.com/northwind/`. You should see the fictional airline site.

Note the service's URL. The default name in `render.yaml` is `quillby-backend`, which gives `https://quillby-backend.onrender.com`. If Render gave it a different URL (for example with a suffix), use that one in the next step.

## 2. Point Vercel at it

If the Render URL is not `quillby-backend.onrender.com`, edit `frontend/vercel.json`: replace that host in the three `destination` lines with yours, and push.

## 3. Deploy the frontend on Vercel

**Dashboard:** Add New > Project > import this repo. Set **Root Directory** to `frontend`. Framework preset: Vite (detected). Deploy. No environment variables are needed.

**Or the CLI:**
```bash
npm i -g vercel
cd frontend
vercel login
vercel --prod
```

## 4. Check it

1. Open the Vercel URL. The landing page loads.
2. **Start your claim**, keep the pre-filled text, upload the three files from `demo-docs/`, press **Take a look at my case**. The review page shows what was read and the policy clauses.
3. Press **Let Quillby fight for this**. The airline site opens in a new tab and the chat starts. It ends with the deal in the chat ("Victory").

If the first request is slow (up to a minute), Render's free tier was asleep. See below.

## Settings (Render environment variables)

| Variable | Purpose |
| --- | --- |
| `PUBLIC_MODE=1` | Turns on the rate limits |
| `CALL_FEATURE=0` | No phone call; the agent concedes in the chat |
| `RATE_INTAKE_PER_HOUR` / `RATE_RUNS_PER_HOUR` | Per visitor, defaults 12 and 6 |
| `DAILY_INTAKE_CAP` / `DAILY_RUN_CAP` | Whole demo, defaults 150 and 80 |
| `REPLAY_MODE=1` | Serve only recorded LLM answers (no Nebius spend). Only the pre-filled demo path then works. |
| `ALLOW_ORIGINS` | Extra CORS origins; not needed while Vercel forwards `/api` |

To spend nothing on Nebius, set `REPLAY_MODE=1` on Render.

## Limits to know about

- **One demo at a time.** There is a single active negotiation. If two people press Start, the second replaces the first. Fine for judges taking turns; not a multi-user product.
- **Render's free tier sleeps** after about 15 minutes idle, and the next request takes up to a minute. Open the health URL a minute before you demo, or use the paid "Starter" plan.
- **State is in memory.** A restart or redeploy clears the current run.
- **Recorded answers** in `backend/cache/` are read from the repo; new answers are written to Render's temporary disk and lost on restart.
- **The agent console** (`#/agent`) and the airline site are public too. Nothing sensitive is on them in the demo (all fictional data).
- **Live updates** use server-sent events through Vercel's forwarding. If the stream is cut, the app falls back to polling by itself.

## The local demo (with the phone call)

Run `./dev.sh` on your laptop with your ElevenLabs and Twilio keys in `.env`. That is the version with the live call.
