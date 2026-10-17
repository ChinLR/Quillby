#!/usr/bin/env bash
(cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 2) &
(cd frontend && npm run dev) &
wait
