#!/usr/bin/env bash
# Start both servers. First clear anything still holding the ports (a reload can leave an orphaned worker behind).
for port in 8000 5173; do
  pids=$(lsof -nP -t -iTCP:$port -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
done
(cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 2) &
(cd frontend && npm run dev) &
wait
