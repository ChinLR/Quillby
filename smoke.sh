#!/usr/bin/env bash
# Smoke test the demo path (see .plans/contract.md). Needs ./dev.sh running.
set -e
B=http://localhost:8000
J='Content-Type: application/json'
curl -sf $B/api/health
curl -sf $B/api/case | head -c 200; echo
ID=$(curl -sf -X POST $B/api/negotiations -H "$J" -d '{"speed":3.0}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "negotiation $ID"
curl -sf $B/api/negotiations/$ID | head -c 200; echo
curl -sf "$B/api/negotiations/$ID/history" | head -c 200; echo
curl -sf $B/api/company/inbox | head -c 200; echo
# Wait for the scripted run to finish (stub takes about 15 s at speed 3), then fetch the report.
for i in $(seq 1 40); do
  S=$(curl -sf $B/api/negotiations/$ID | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
  [ "$S" = "won" ] || [ "$S" = "walked_away" ] || [ "$S" = "failed" ] && break
  sleep 1
done
echo "status $S"
[ "$S" = "won" ]
curl -sf $B/api/negotiations/$ID/report | head -c 200; echo
echo "SMOKE OK"
