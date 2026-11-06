import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Server, type Socket } from 'socket.io';
import {
  DEFAULT_ROOM_ORDER,
  TICK_MS,
  advance,
  applyIntent,
  initialState,
  publicState,
  isIntent,
  parseRoomOrder,
  reportKey,
  type ClientToServerEvents,
  type GameState,
  type Hello,
  type MorningReport,
  type ServerToClientEvents,
  type Snapshot,
} from '@night-shift/shared';
import { Control } from './control';
import { reportMode, writeMorningReport } from './morningReport';
import { resolvePresenterKey } from './presenterKey';
import { BestRecord } from './record';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ROOT = path.resolve(import.meta.dirname, '../..');
const CLIENT_DIST = path.join(ROOT, 'client/dist');

// Local secrets live in the repo-root .env (git-ignored). On Render they come from the dashboard.
const ENV_FILE = path.join(ROOT, '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const PORT = Number(process.env.PORT) || 3001;
/** `npm run dev`: Vite serves the client on 5173 and proxies /socket.io here. */
const DEV = process.argv.includes('--dev');
const VITE_URL = 'http://localhost:5173';
const PUBLIC_URL = (process.env.RENDER_EXTERNAL_URL || (DEV ? VITE_URL : `http://localhost:${PORT}`)).replace(/\/$/, '');

// Presenter access needs ?presenter=<key>. See presenterKey.ts for where the key comes from.
const { key: PRESENTER_KEY, source: KEY_SOURCE } = resolvePresenterKey(process.env);

// How the five screens physically stand in the room, left to right, e.g. ROOM_ORDER=2,1,3,4,5.
// Each /screen/x page uses it for the power-on order, the Lights on wave and the Input → Output strip.
const ROOM_ORDER_RAW = process.env.ROOM_ORDER?.trim();
const ROOM_ORDER = parseRoomOrder(ROOM_ORDER_RAW) ?? [...DEFAULT_ROOM_ORDER];
if (ROOM_ORDER_RAW && !parseRoomOrder(ROOM_ORDER_RAW)) {
  console.warn(`ROOM_ORDER="${ROOM_ORDER_RAW}" ignored: list each screen 1–5 exactly once, e.g. 2,1,3,4,5.`);
}

const app = express();
const httpServer = createServer(app);
// Snapshots are repetitive JSON at 10 Hz; compressing them keeps remote judges on slow links happy.
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  perMessageDeflate: { threshold: 1024 },
});

// Health check for Render, and a quick way to see that the server is up.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, phase: state.phase, clients: io.engine.clientsCount, roomOrder: ROOM_ORDER.join(',') });
});

// Serve the built client (npm start). In development Vite serves the live client instead, so an old
// build in client/dist is never served by mistake.
const SERVE_DIST = !DEV && existsSync(CLIENT_DIST);
if (SERVE_DIST) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ---------- Authoritative state ----------

let state: GameState = initialState();
const control = new Control(PRESENTER_KEY);
// The best night so far: kept across nights and restarts (a git-ignored file next to .env, or RECORD_FILE).
const record = new BestRecord(process.env.RECORD_FILE || path.join(ROOT, '.night-shift-record.json'));

function snapshot(): Snapshot {
  return {
    ...publicState(state),
    codeVisible: control.code !== null,
    controllers: control.controllerCount,
    viewers: io.engine.clientsCount,
    record: record.state,
  };
}

function broadcast(): void {
  io.emit('snapshot', snapshot());
}

function sendControl(socket: GameSocket): void {
  const role = control.role(socket.id);
  socket.emit('control', { role, code: role === 'presenter' ? control.code : null });
}

function sourceKey(socket: GameSocket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || socket.handshake.address;
}

// ---------- Morning report ----------

// Written once per night, when it ends. Clients get only the finished report, never the API key.
let report: MorningReport | null = null;
let reportFor: string | null = null;

function checkReport(): void {
  const key = state.outcome ? reportKey(state.outcome) : null;
  if (key === reportFor) return;
  reportFor = key;
  if (report) {
    report = null;
    io.emit('report', null);
  }
  if (!key) {
    record.nextNight();
    return;
  }
  if (state.outcome && record.count(key, state.outcome.summary.careContinuity)) {
    console.log(`New record: ${state.outcome.summary.careContinuity}%`);
  }
  void writeMorningReport(state).then((written) => {
    if (written.key !== reportFor) return; // the game was reset meanwhile
    report = written;
    io.emit('report', written);
  });
}

// A bug in one tick must never take the live demo down: log it, keep the last good state, carry on.
let tickErrors = 0;
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  try {
    state = advance(state, now - last);
    checkReport();
  } catch (err) {
    if (tickErrors++ < 5) console.error('Tick failed, keeping the last good state:', err);
  }
  last = now;
  broadcast();
}, TICK_MS);

// ---------- Connections ----------

io.on('connection', (socket) => {
  socket.emit('wall', { order: ROOM_ORDER });
  socket.emit('report', report);
  socket.emit('snapshot', snapshot());
  sendControl(socket);

  socket.on('hello', (raw: Partial<Hello> | undefined, ack: unknown) => {
    const hello: Hello = {
      presenterKey: typeof raw?.presenterKey === 'string' ? raw.presenterKey : null,
      code: typeof raw?.code === 'string' ? raw.code : null,
    };
    const role = control.register(socket.id, hello);
    if (typeof ack === 'function') ack(role);
    sendControl(socket);
    broadcast();
  });

  socket.on('intent', (intent: unknown) => {
    if (!isIntent(intent)) return;
    const denied = control.check(socket.id, intent.type);
    if (denied) {
      socket.emit('notice', denied);
      return;
    }

    if (intent.type === 'toggleCode') {
      const { visible, revoked } = control.toggleCode();
      for (const s of io.sockets.sockets.values()) sendControl(s);
      for (const id of revoked) io.to(id).emit('notice', 'Control was handed back. You are watching.');
      socket.emit(
        'notice',
        visible
          ? `Control code ${control.code} is on the Security Office screen.`
          : 'Control code hidden. Extra control revoked.',
      );
    } else if (intent.type === 'clearRecord') {
      record.clear();
      socket.emit('notice', 'Record cleared. The next night sets a new one.');
    } else {
      try {
        const result = applyIntent(state, intent);
        state = result.state;
        if (result.error) socket.emit('notice', result.error);
      } catch (err) {
        console.error(`Intent ${intent.type} failed, ignored:`, err);
        socket.emit('notice', "That didn't work. Try again.");
      }
    }
    checkReport();
    broadcast();
  });

  socket.on('enterCode', (code: unknown, ack: unknown) => {
    const result = control.tryCode(socket.id, sourceKey(socket), code);
    if (typeof ack === 'function') ack(result);
    if (result.ok) {
      sendControl(socket);
      broadcast();
    }
  });

  socket.on('disconnect', () => {
    control.remove(socket.id);
  });
});

httpServer.listen(PORT, () => {
  const mode = SERVE_DIST ? 'serving client/dist' : DEV ? `dev: open the pages on ${VITE_URL}` : 'API only (build the client first)';
  console.log(`NIGHT SHIFT server on http://localhost:${PORT} (${mode})`);
  console.log(`Morning report: ${reportMode()}`);
  console.log(`Screens in the room, left to right: ${ROOM_ORDER.join(' ')} (ROOM_ORDER)`);
  const link = `${PUBLIC_URL}/screen/2?presenter=${encodeURIComponent(PRESENTER_KEY)}`;
  if (KEY_SOURCE === 'env') {
    console.log('Presenter key: from PRESENTER_KEY. Presenter link:');
    // On Render the log is visible to anyone with dashboard access, so the key itself is not printed there.
    console.log(process.env.RENDER ? `  ${PUBLIC_URL}/screen/2?presenter=<PRESENTER_KEY>` : `  ${link}`);
  } else if (KEY_SOURCE === 'dev-default') {
    console.log(`Presenter key: "${PRESENTER_KEY}" (local default; set PRESENTER_KEY in .env to change it). Presenter link:`);
    console.log(`  ${link}`);
  } else {
    console.warn('PRESENTER_KEY is not set on Render. One-off presenter key for this run (changes on every restart):');
    console.warn(`  ${link}`);
  }
});
