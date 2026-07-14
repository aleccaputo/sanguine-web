---
name: verify
description: Build/launch/drive recipe for verifying sanguine-web UI changes at runtime
---

# Verifying sanguine-web changes

## Launch

```bash
npm run dev    # Express + Vite HMR — serves on http://localhost:5173 (NOT 3000)
```

First page load compiles on demand and hits live external APIs (WOM, OSRS
wiki prices) — allow 30-120s timeouts on first request per route.

## Finding real data to drive

- Event ids aren't in hrefs (rows navigate via onClick). Extract them from the
  embedded loader JSON in `/events` HTML: regex `\\?"id\\?":(\d{4,})`.
  Known-good event with drops: `144882`. Some ids 500 (bad/foreign comps).
- Participant discordIds with drops: regex `destinationDiscordId\\?":\\?"(\d+)`
  over the event page HTML, group by count.
- The participant breakdown dialog deep-links: `/events/<id>?participant=<key>`
  (key is a discordId, or `discordId:AltName` URL-encoded for alts).

## Screenshots

- Desktop: headless Chrome works:
  `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new
  --disable-gpu --force-device-scale-factor=1 --window-size=1280,900
  --virtual-time-budget=15000 --screenshot=out.png <url>`
- **Mobile: do NOT trust `--window-size=390,...`** — Windows DPI scaling clips
  content and fakes horizontal overflow. Use real CDP emulation
  (`Emulation.setDeviceMetricsOverride` width 390) — launch Chrome with
  `--remote-debugging-port` + `--user-data-dir=<scratch>` and drive it with a
  Node script using the built-in WebSocket (Node 22+; no deps needed):
  fetch `/json` for the ws URL, send `Page.enable` → override → `Page.navigate`
  → wait `Page.loadEventFired` + ~4s hydration → `Page.captureScreenshot`.
  Also evaluate `document.documentElement.scrollWidth` to check overflow
  numerically instead of eyeballing.
- Recharts entrance animations may not have painted at screenshot time — an
  "empty" chart with axes drawn is usually the animation, not missing data.
  Interactive elements can be clicked via `Runtime.evaluate` (`el.click()`).
