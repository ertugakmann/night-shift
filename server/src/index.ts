import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Server, type Socket } from 'socket.io';
import {
  TICK_MS,
  advance,
  applyIntent,
  initialState,
  publicState,
  isIntent,
  type ClientToServerEvents,
  type GameState,
  type Hello,
  type ServerToClientEvents,
  type Snapshot,
} from '@night-shift/shared';
import { Control } from './control';
import { resolvePresenterKey } from './presenterKey';

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

const app = express();
const httpServer = createServer(app);
// Snapshots are repetitive JSON at 10 Hz; compressing them keeps remote judges on slow links happy.
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  perMessageDeflate: { threshold: 1024 },
});

// Health check for Render, and a quick way to see that the server is up.
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, phase: state.phase, clients: io.engine.clientsCount });
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

function snapshot(): Snapshot {
  return {
    ...publicState(state),
    codeVisible: control.code !== null,
    controllers: control.controllerCount,
    viewers: io.engine.clientsCount,
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

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  state = advance(state, now - last);
  last = now;
  broadcast();
}, TICK_MS);

// ---------- Connections ----------

io.on('connection', (socket) => {
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
    } else {
      const result = applyIntent(state, intent);
      state = result.state;
      if (result.error) socket.emit('notice', result.error);
    }
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
