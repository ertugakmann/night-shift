import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { enterCode, showNotice, useGame } from '../net/game';

/** Page-level overlay: connection state, role badge, code entry for watchers, presenter key hints, notices. */
export function Hud() {
  const { connected, role, snapshot, notice, transport } = useGame();
  // The building screens (1, 3, 4, 5) are view-only displays on the wall: no code box over the art.
  // Remote judges join from the desk (screen 2) or /wall.
  const { pathname } = useLocation();
  const buildingScreen = /^\/screen\/[1345]$/.test(pathname);
  // On /preview the tab bar runs along the bottom; sit above it so no tab is covered.
  const bottom = pathname === '/preview' ? 'bottom-20' : 'bottom-3';

  return (
    <>
      {notice && (
        <div
          key={notice.id}
          role="status"
          className="pointer-events-none fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-night-800/95 px-4 py-2 text-base shadow-lg ring-1 ring-white/15"
        >
          {notice.text}
        </div>
      )}

      <div className={`fixed right-3 ${bottom} z-40 flex flex-col items-end gap-2 text-base`}>
        {!connected && <Badge className="bg-danger/90 text-night-950">Reconnecting…</Badge>}

        {role === 'presenter' && (
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md bg-night-950/80 px-2 py-1 text-ink/60 lg:inline">
              S start · Space pause · R reset · L lights · D debug · C code · M sound
            </span>
            {snapshot && (
              <span className="rounded-md bg-night-950/80 px-2 py-1 text-ink/60">
                {snapshot.viewers} open · {snapshot.controllers} joined
              </span>
            )}
            {transport && (
              <span className={`rounded-md bg-night-950/80 px-2 py-1 ${transport === 'websocket' ? 'text-safe' : 'text-suspect'}`}>
                {transport === 'websocket' ? 'WebSocket' : 'Polling'}
              </span>
            )}
            <Badge className="bg-flash text-night-950">Presenter</Badge>
          </div>
        )}
        {role === 'controller' && <Badge className="bg-safe text-night-950">In control</Badge>}
        {role === 'watcher' && !buildingScreen && <WatcherBox codeOpen={snapshot?.codeVisible ?? false} />}
      </div>
    </>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-3 py-1 font-semibold ${className}`}>{children}</span>;
}

function WatcherBox({ codeOpen }: { codeOpen: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await enterCode(code);
    setBusy(false);
    showNotice(result.message);
    if (result.ok) setCode('');
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-lg bg-night-950/85 p-1.5 ring-1 ring-white/10">
      <Badge className="bg-white/10 text-ink/80">Watching</Badge>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        placeholder={codeOpen ? 'Code' : '----'}
        aria-label="Control code"
        className="w-20 rounded-md bg-night-800 px-2 py-1 text-center font-mono text-base tracking-widest outline-none focus:ring-2 focus:ring-locked"
      />
      <button
        type="submit"
        disabled={code.length !== 4 || busy}
        className="rounded-md bg-locked px-3 py-1 font-semibold text-night-950 disabled:opacity-40"
      >
        Join
      </button>
    </form>
  );
}
