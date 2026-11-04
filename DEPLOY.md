# Deploying NIGHT SHIFT

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

## Offline fallback (laptop)

```
npm ci
npm run build
npm start
```
Put `PRESENTER_KEY=...` in `.env` (see `.env.example`). Without it the local default key
`nightshift-dev` is used, which anyone on the same network could guess: set your own for the demo. Other devices on the same network: `http://<laptop-ip>:3001/screen/3`.
