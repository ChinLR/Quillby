# Contract (frozen after commit; change only with a heads-up)

## Endpoints
- GET  /api/<thing>      -> { items: [ { id, name, ... } ] }
- POST /api/<action>     body: { ... }  ->  { ... }

## LLM output schemas (small and flat)
<name>: { "field": "string", "score": 0, "items": ["string"] }

## Seed data shapes
backend/seed/<thing>.json : [ { id, name, ... } ]  (20-30 realistic records)

## Demo path (what must work end to end)
1. ... 2. ... 3. ...
