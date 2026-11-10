<div align="center">

# 🌙 NIGHT SHIFT

**Every night, a SOC team guards a hospital's systems the way night guards protect a museum full of priceless exhibits.**

An interactive, multi-screen cyber incident game for hospital Security Operations Centres.
Built for the **Cyber Care Hackathon** at Bournemouth University, for **MoSAIcSOC** (EU Horizon Europe / ECCC).

`TypeScript` · `React` · `Socket.IO` · `Framer Motion` · `Claude`

</div>

---

## 🔦 The idea

The lights are off. An invisible gang of intruders is creeping from gallery to gallery.
You are the night security team: send your guards **Sam**, **Mia** and **Tom** to patrol, lock doors and catch the intruders
before they reach **the Vault**, while keeping the museum's exhibits running until dawn.

Then press **`L`**. The lights come on, wave by wave, across every screen and the museum turns out to be a hospital:

| 🏛️ Museum | 🏥 Hospital |
|---|---|
| Galleries and exhibits | Departments and clinical systems |
| Intruders in berets | Ransomware moving laterally |
| CCTV glitches | SOC alerts |
| Rex, the guard dog | AI copilot (usually right… usually) |
| Lock a door | Isolate a system |
| Candlelight mode | Clinical downtime procedures |
| The Vault | Electronic patient records |
| Morning report | AI-written SOC shift handover |

The museum is a metaphor. **The patients are not**: delayed tests, medicines, surgeries and diverted ambulances are counted for real in both views.

## ✨ What makes it different

- **People are sensors.** Radio chatter from nurses and lab staff sits next to CCTV alerts as equal clues.
- **The AI can be wrong.** Rex explains every bark, and the morning report analyses how much you trusted him.
- **Every lock has a cost.** Isolating a room stops the spread but takes its services offline. You win on **care kept running**, not intruders caught.

## 🖥️ Five screens, one building

Built for a 5-screen display wall. Each screen is its own URL, and they all share one live game over WebSockets.
Guards and intruders walk across screen borders.

| URL | Screen |
|---|---|
| `/screen/1` | Lobby and Offices (where the intruders get in) |
| `/screen/2` | The head guard's desk: radio, Rex, alerts, actions (touch friendly) |
| `/screen/3` | West Wing: Lab and Pharmacy |
| `/screen/4` | East Wing: Emergency, Ward 4, Radiology |
| `/screen/5` | The Vault, the night clock and the Care score |
| `/wall` | Single-projector mode: a cosy first-person security office with 5 zoomable monitors |
| `/preview` | All 5 screens on one display, switch with ← → |

Remote players can join any page and take control with a 4-digit code.

## 🚀 Quick start

Requires **Node 20.12+**.

```bash
npm install
npm run dev        # server on :3001, client on http://localhost:5173
```

Open http://localhost:5173/wall?presenter=nightshift-dev and press **`S`** to start the night.

```bash
npm test           # engine tests (determinism, balance, bots)
npm run build && npm start   # production build, served on :3001
```

Optional `.env` (see [`.env.example`](.env.example)):

| Variable | Purpose |
|---|---|
| `PRESENTER_KEY` | Presenter access (`?presenter=<key>`) |
| `ROOM_ORDER` | Physical screen order, left to right (default `2,1,3,4,5`) |
| `ANTHROPIC_API_KEY` | Lets Claude write the morning report. Without it, a template writes it. |

## ⌨️ Presenter keys

| Key | Action |
|---|---|
| `S` | Start the shift |
| `Enter` | Start the night after the briefing (twice: skip the intro) |
| `Space` | Pause |
| `L` | **Lights on**: flip to the hospital / SOC view |
| `C` | Show or revoke the control code |
| `M` | Sound on / off |
| `D` | Debug: show true intruder positions |
| `R` | Reset (twice during a night) |

## 🧱 How it's built

```
shared/   game engine: a pure, seeded step(state, dt, intents) function + scenario JSON
server/   Node + Express + Socket.IO, ticks at 10 Hz, broadcasts snapshots
client/   Vite + React + Tailwind + Framer Motion, everything drawn in SVG
```

- **Server-authoritative**: clients only send intents, so refreshing any screen is always safe.
- **Deterministic**: a seeded RNG makes the demo replay identically unless players act.
- **No assets**: every character, room and sound is drawn or synthesised in code.
- **AI morning report**: Claude Haiku writes a warm note from the Chief *and* a real SOC handover, with a template fallback so the demo never depends on the network.

Deployment notes are in [`DEPLOY.md`](DEPLOY.md).

---

<div align="center">

<img src="client/public/brand/mosaicsoc-banner.png" alt="MoSAIcSOC · Co-funded by the European Union · ECCC" width="650">

*Made in three days for the Cyber Care Hackathon, with Claude.*

</div>
