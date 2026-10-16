#!/usr/bin/env bash
set -e
B=http://localhost:8000
curl -sf $B/api/health
# one line per demo-path endpoint, in order, e.g.:
# curl -sf $B/api/<thing> | head -c 200
# curl -sf -X POST $B/api/<action> -H 'Content-Type: application/json' -d '{}' | head -c 200
echo && echo "SMOKE OK"
