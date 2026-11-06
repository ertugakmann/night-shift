// "Change the locks": the gang has the master keys. Type the short code (OWL-7) before time runs out,
// on a keyboard or with the tiles (touch screens). Reality view: an emergency reset of the admin passwords.
// Keyboard typing is handled once per page in usePresenterKeys, so this only draws and takes taps.
import { useRef } from 'react';
import { sendIntent, useGame } from '../net/game';
import { PresenterCursor, useMirrorPointer } from '../desk/PresenterCursor';
import { worldOf } from '../game/view';
import { MiniHeader, MiniResult } from './MiniHeader';

const W = 1600;
const H = 900;

export function KeysGame({ reality }: { reality: boolean }) {
  const { snapshot, role, pointer } = useGame();
  const svg = useRef<SVGSVGElement>(null);
  const mirror = useMirrorPointer(svg);
  const k = snapshot?.keys;
  if (!snapshot || !k) return null;
  const canAct = role !== 'watcher' && k.result === null;
  const chars = k.code.replace('-', '');
  const wrong = k.wrongAtMs !== null && snapshot.timeMs - k.wrongAtMs < 500;
  const w = worldOf(snapshot);
  const tileW = 120;
  const gap = 22;
  const tilesX = (W - (k.tiles.length * tileW + (k.tiles.length - 1) * gap)) / 2;

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={mirror.press}
      onPointerMove={mirror.track}
      onPointerLeave={mirror.leave}
      role="application"
      aria-label="Change the locks"
    >
      {reality ? <rect width={W} height={H} fill="#0a1120" /> : <rect width={W} height={H} fill="#2a1d5c" />}
      {/* the alert */}
      <g className={reality ? 'soc-text' : 'game-text'}>
        <rect x={180} y={150} width={W - 360} height={300} rx={reality ? 16 : 36} fill={reality ? '#1a0f16' : '#17123a'} stroke="#ff6b6b" strokeWidth={6} className={k.result === null ? 'danger-pulse' : ''} />
        <text x={W / 2} y={222} textAnchor="middle" fontSize={34} fontWeight={800} fill="#ff9a8a">
          {reality ? 'Domain admin credentials compromised' : 'The intruders stole the master keys!'}
        </text>
        <text x={W / 2} y={266} textAnchor="middle" fontSize={24} fill={reality ? '#cfe0f5' : '#fff1cf'}>
          {reality ? 'Emergency password reset. Enter the confirmation code:' : 'Change every lock in the museum. Type the code:'}
        </text>
        {/* the code on a brass tag, with the typed part lit */}
        <g transform={`translate(${W / 2},360)`}>
          <rect x={-230} y={-62} width={460} height={110} rx={reality ? 10 : 26} fill={reality ? '#0d1729' : '#c9913c'} stroke={reality ? '#2f4a73' : '#f2c65e'} strokeWidth={5} className={wrong ? 'shake' : ''} />
          {(() => {
            let n = 0; // characters before this one, not counting the dash
            return [...k.code].map((c, i) => {
            const typed = c !== '-' && n++ < k.typed;
            return (
              <text key={i} x={-165 + i * 82} y={20} textAnchor="middle" fontSize={68} fontWeight={800} className={reality ? 'soc-mono' : ''} fill={c === '-' ? (reality ? '#7f8ea8' : '#5a3a22') : typed ? (reality ? '#3ee0d8' : '#fff1cf') : reality ? '#7f8ea8' : '#3a2a1a'} style={{ transition: 'fill 150ms ease' }}>
                {c}
              </text>
            );
            });
          })()}
        </g>
      </g>
      {/* tiles: for touch screens (keyboards just type) */}
      {k.tiles.map((c, i) => {
        const x = tilesX + i * (tileW + gap);
        return (
          <g
            key={i}
            transform={`translate(${x},560)`}
            style={{ cursor: canAct ? 'pointer' : 'default' }}
            onPointerDown={(e) => {
              if (!canAct) return;
              e.preventDefault();
              sendIntent({ type: 'code', char: c });
            }}
          >
            <rect width={tileW} height={130} rx={reality ? 10 : 24} fill={reality ? '#13233d' : '#fff4e0'} stroke={reality ? '#3a5680' : '#c9913c'} strokeWidth={4} />
            <rect y={112} width={tileW} height={18} rx={reality ? 6 : 12} fill={reality ? '#0d1729' : '#e8d3a8'} />
            <text x={tileW / 2} y={86} textAnchor="middle" fontSize={64} fontWeight={800} className={reality ? 'soc-mono' : 'game-text'} fill={reality ? '#e6edf7' : '#2a1d5c'}>
              {c}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={760} textAnchor="middle" className={reality ? 'soc-text' : 'game-text'} fontSize={22} fill={reality ? '#7f8ea8' : '#b9adf0'} pointerEvents="none">
        {wrong ? (reality ? 'Code mismatch: start again' : 'Wrong key! Start again') : canAct ? 'Type it on the keyboard, or tap the tiles' : role === 'watcher' ? 'Watching' : ''}
      </text>
      <MiniHeader
        title={reality ? 'Reset the admin passwords' : 'Change the locks!'}
        sub={reality ? 'Stolen credentials: revoke them before they are used' : 'The Key Room fell: new locks before they use the master keys'}
        snapshot={snapshot}
        startedMs={k.startedMs}
        endsMs={k.result === null ? k.endsMs : snapshot.timeMs}
        limitMs={w.ms.keys}
        done={k.typed}
        total={chars.length}
        flash={wrong}
        reality={reality}
        canAct={role !== 'watcher'}
      />
      {k.result && (
        <MiniResult
          good={k.result === 'changed'}
          reality={reality}
          title={k.result === 'changed' ? (reality ? 'Credentials revoked' : 'New locks fitted!') : reality ? 'Reset missed' : 'Too slow!'}
          sub={k.result === 'changed' ? (reality ? 'The stolen admin passwords no longer work.' : 'The master keys are useless now.') : reality ? 'Stolen admin credentials still valid.' : 'The intruders keep the master keys.'}
        />
      )}
      {role === 'watcher' && <PresenterCursor pointer={pointer} />}
    </svg>
  );
}
