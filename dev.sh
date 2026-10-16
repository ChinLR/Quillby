#!/usr/bin/env bash
(cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000) &
(cd frontend && npm run dev) &
wait
