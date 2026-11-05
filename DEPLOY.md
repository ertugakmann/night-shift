# Deploying NIGHT SHIFT

Demo day: see `DEMO.md` (waking Render, the room set-up, what to do when something breaks, the offline plan).

## Render (online)

1. Push to GitHub.
2. Render dashboard → **New → Blueprint** → pick the repo. `render.yaml` sets everything up:
   build `npm ci --include=dev && npm run build`, start `npm start`, health check `/healthz`, Node 22,
   and a generated `PRESENTER_KEY`.
3. When the deploy is live, copy `PRESENTER_KEY` from the service's **Environment** tab.
4. Check it from your laptop:
   ```
   npm run check:deploy -- https://<app>.onrender.com <PRESENTER_KEY>
   ```
5. Presenter: `https://<app>.onrender.com/wall?presenter=<PRESENTER_KEY>`.
   Everyone else: the same URL without `?presenter`.

The key is removed from the address bar after the page loads and kept in that tab only.
Open each presenter tab with the full link once; after that, refreshing the tab is fine.

**Rules**
- One instance only. The game lives in server memory.
- Free plan sleeps after 15 min idle (about 1 min to wake) and every restart or redeploy resets the game.
  For demo day, switch the plan to **Starter**, or open the site well before 12:00 and keep a tab open.
- Don't push during the demo: auto-deploy restarts the server.

## Screen order in the room

Set `ROOM_ORDER` to the screen numbers as they physically stand, left to right. Default `2,1,3,4,5`:
the desk on the far left, then the lobby, west wing, east wing and the Vault. Each `/screen/x` page uses it
for the power-on order at shift start, the Lights on wave and its piece of the Input → NIGHT SHIFT → Output
strip. `/wall` and `/preview` always keep the order 1 to 5. An invalid value is ignored with a warning,
and the server prints the order it uses at startup (also on `/healthz`). Changing it needs a restart.

## Morning report (Claude, optional)

Set `ANTHROPIC_API_KEY` (Render: the **Environment** tab; locally: `.env`) to have the morning report
written by Claude (`claude-haiku-5-5`). It is written once when the night ends, in both voices (the
head guard's note and the SOC shift handover), so **L** switches between them instantly.

Without a key, on any API error, or if no answer comes within 8 s, the server writes the same report
from a template instead. The demo never depends on the API. A small tag on the report says which one
wrote it ("Written by AI" or "Template report"). The server prints which mode it is in at startup and
logs each report (`Morning report: written by Claude in 2.1 s` or `Morning report: template (...)`).

The key is only read by the server. Browsers receive the finished report, never the key.

## Offline fallback (laptop)

```
npm ci
npm run build
npm start
```
Put `PRESENTER_KEY=...` in `.env` (see `.env.example`). Without it the local default key
`nightshift-dev` is used, which anyone on the same network could guess: set your own for the demo. Other devices on the same network: `http://<laptop-ip>:3001/screen/3`.
