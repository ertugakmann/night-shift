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
  isIntent,
  type ClientToServerEvents,
  type GameState,
  type Hello,
  type ServerToClientEvents,
  type Snapshot,
} from '@night-shift/shared';
import { Control } from './control';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const PORT = Number(process.env.PORT) || 3001;
const PRESENTER_KEY = process.env.PRESENTER_KEY?.trim() || null;
const CLIENT_DIST = path.resolve(import.meta.dirname, '../../client/dist');

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

// Serve the built client (npm start). In development Vite serves it and proxies /socket.io here.
if (existsSync(CLIENT_DIST)) {
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
    ...state,
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

  socket.on('hello', (raw: Partial<Hello> | undefined) => {
    const hello: Hello = {
      presenterKey: typeof raw?.presenterKey === 'string' ? raw.presenterKey : null,
      code: typeof raw?.code === 'string' ? raw.code : null,
    };
    control.register(socket.id, hello);
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
  const mode = existsSync(CLIENT_DIST) ? 'serving client/dist' : 'API only (run the Vite dev server)';
  console.log(`NIGHT SHIFT server on http://localhost:${PORT} (${mode})`);
  if (PRESENTER_KEY) console.log('Presenter pages need ?presenter=<PRESENTER_KEY>');
});
