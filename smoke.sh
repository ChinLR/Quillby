#!/usr/bin/env bash
# Smoke test the demo path (see .plans/contract.md). Needs ./dev.sh running.
# The chat ends with the agent asking to call; the smoke test records the call
# result with the manual outcome endpoint, so it never needs a real phone call.
# With CALL_FEATURE=0 the deal is settled in the chat and no call step happens.
set -e
B=http://localhost:8000
J='Content-Type: application/json'
py() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

curl -sf $B/api/health; echo
curl -sf -X POST $B/api/reset >/dev/null
curl -sf $B/api/case | head -c 150; echo
curl -sf -X POST $B/api/intake -H "$J" -d '{"description":"My Northwind flight from Edinburgh to Faro landed almost 4 hours late and they blamed operational reasons. I want my compensation."}' | py 'd["supported"], d["case"]["delay_minutes"]'
ID=$(curl -sf -X POST $B/api/negotiations -H "$J" -d '{"speed":3.0}' | py 'd["id"]')
echo "negotiation $ID"
curl -sf "$B/api/negotiations/$ID/history" | head -c 150; echo
curl -sf $B/api/company/inbox | head -c 150; echo
# Wait for the end of the chat: a call request (the normal demo) or a finished deal (CALL_FEATURE=0).
for i in $(seq 1 120); do
  S=$(curl -sf $B/api/negotiations/$ID | py 'd["status"]')
  case $S in awaiting_call|on_call|won|walked_away|failed) break;; esac
  sleep 1
done
echo "status $S"
if [ "$S" = "awaiting_call" ]; then
  curl -sf $B/api/negotiations/$ID/call | head -c 200; echo
  curl -sf $B/api/company/inbox | py '"call_number:", repr(d["call_number"])'
  curl -sf -X POST $B/api/negotiations/$ID/call/outcome -H "$J" -d '{"amount_gbp":350,"offer_type":"cash"}' | py 'd["status"]'
fi
[ "$S" = "awaiting_call" ] || [ "$S" = "won" ]
curl -sf $B/api/negotiations/$ID/report | py 'd["outcome"], d["amount_gbp"], d["resolved_on"]'
echo "SMOKE OK"
