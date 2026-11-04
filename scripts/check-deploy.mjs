// Checks a running NIGHT SHIFT server from the outside, the way a remote judge would reach it.
//   npm run check:deploy -- https://night-shift.onrender.com [presenter-key]
//   npm run check:deploy                       (defaults to http://localhost:3001)
import { io } from 'socket.io-client';

const base = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');
const presenterKey = process.argv[3] || null;
const TIMEOUT_MS = 90_000; // a sleeping free Render instance can take about a minute to wake

let failed = false;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
};

function connect(options) {
  return new Promise((resolve, reject) => {
    const socket = io(base, { reconnection: false, timeout: TIMEOUT_MS, ...options });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timed out'));
    }, TIMEOUT_MS);
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
    socket.once('snapshot', (snapshot) => {
      clearTimeout(timer);
      resolve({ socket, snapshot });
    });
  });
}

function hello(socket, key) {
  return new Promise((resolve) => socket.emit('hello', { presenterKey: key, code: null }, resolve));
}

console.log(`Checking ${base}`);

// 1. Plain HTTP and the health check (also wakes a sleeping free instance).
try {
  const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.json();
  if (res.ok && body.ok) ok(`/healthz answered (phase ${body.phase}, ${body.clients} clients)`);
  else bad(`/healthz returned ${res.status}`);
} catch (err) {
  bad(`/healthz unreachable: ${err.message}`);
}

// 2. WebSocket only, no polling fallback. This is what fails if the host blocks WebSockets.
try {
  const { socket, snapshot } = await connect({ transports: ['websocket'] });
  ok(`WebSocket-only connection works, snapshot received (counter ${snapshot.counter})`);

  const weakRole = await hello(socket, '1');
  if (weakRole === 'presenter') bad('?presenter=1 still grants presenter access');
  else ok('?presenter=1 is rejected');

  if (presenterKey) {
    const role = await hello(socket, presenterKey);
    if (role === 'presenter') ok('your PRESENTER_KEY is accepted');
    else bad('your PRESENTER_KEY was NOT accepted (check the value on the server)');
  }
  socket.close();
} catch (err) {
  bad(`WebSocket-only connection failed: ${err.message}`);
}

// 3. Default browser behaviour: start on polling, then upgrade to WebSocket.
try {
  const { socket } = await connect({});
  const engine = socket.io.engine;
  if (engine.transport.name !== 'websocket') {
    await new Promise((resolve) => {
      engine.once('upgrade', resolve);
      setTimeout(resolve, 5000);
    });
  }
  if (engine.transport.name === 'websocket') ok('browser-style connection upgraded to WebSocket');
  else bad(`browser-style connection stayed on ${engine.transport.name}`);
  socket.close();
} catch (err) {
  bad(`browser-style connection failed: ${err.message}`);
}

console.log(failed ? '\nSome checks failed.' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
