# Fake airline website: Spec

Status: v1, built 2026-10-17. Goal: make the demo look real. The audience sees "Northwind Air's website" with its support chat while Counterbot argues in it.

## What it is

A one-page fictional airline site (Northwind Air, no real brand) with a support chat widget. The chat is the point; the rest is decoration so it looks like a real company site.

- Location: `airline-site/index.html`, a single file (HTML, CSS, vanilla JS). No build step, no dependencies.
- Served by the backend at `http://localhost:8000/northwind/` (same origin, so no CORS, no second server).
- Read only: it shows the conversation from the airline's side. It never sends anything.
- Needs no new API and no contract change. It polls `GET /api/company/inbox` every 800 ms.

## The chat widget (priority one)

Seen from the airline's customer view:

| Element | Behaviour |
| --- | --- |
| Launcher | Round "Help" button, bottom right. The panel opens by itself when the first message arrives. |
| Header | "Nova, Northwind virtual assistant" with a green dot. After the handoff it switches to "Sam, Northwind customer care" with a "Live agent" badge. |
| Airline messages (left) | White bubbles with an avatar. A typing indicator shows for about 0.7 s before each one. |
| Customer messages (right) | Blue bubbles, tagged "Sent by Li Ren's assistant" (the `sender_label`). |
| Quick-reply buttons | Pills under the airline's message. When the next customer message has a `clicked_button`, that pill highlights and the rest grey out. |
| Handoff | A divider line "Sam joined the chat" before the first `human_agent` message. |
| Call | When `call_number` is set, a banner: "Sam is calling Li Ren's assistant on +…". Once call lines exist (`channel: "call"`): "Call completed. Thanks for your patience." Call lines themselves are not shown in the chat. |
| Input box | Disabled (nobody types in it). Cosmetic animation: when Counterbot's message arrives, its text types out letter by letter in the box and is then "sent"; when Counterbot clicks a menu button, that pill flashes before the message lands. It is still a mirror of what the backend decided: nothing is really typed into the page. |
| Reset | If the inbox returns 404 (no negotiation, or reset), the widget clears and closes. |

Messages are revealed one at a time from a queue, so even if several arrive in one poll they appear line by line.

## The rest of the page (decoration, kept minimal)

Top bar with logo and links, a hero with a non-functional flight search card (Edinburgh to Faro), three route cards, and a footer line "Northwind Air is a fictional airline for a hackathon demo". Nothing else works.

## Data it uses

From `GET /api/company/inbox`: `messages[]` (`id`, `sender`, `sender_label`, `text`, `buttons`, `clicked_button`, `channel`), `handed_off`, `call_number`. Chat messages are `channel: "chat"`.

## Out of scope

Real booking, login, any write call, the agent reply box (that is `#/agent` in the main frontend), call transcript display, mobile layout polish.

## How to use in the demo

Open it in its own browser window next to the Counterbot dashboard. Start a negotiation from the dashboard; the chat on the airline site fills in as it happens.
