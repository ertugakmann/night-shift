import { useGame } from '../net/game';

/** Shown on the Security Office screen while a control code is active. Only presenter pages know the digits. */
export function ControlCodeCard() {
  const { snapshot, role, code } = useGame();
  if (!snapshot?.codeVisible) return null;

  return (
    <div className="absolute top-2 right-3 rounded-lg border border-locked/60 bg-night-950/80 px-4 py-2 text-right">
      <div className="text-base text-ink/70">Control code</div>
      {role === 'presenter' && code ? (
        <div className="font-mono font-bold tracking-[0.2em] text-locked" style={{ fontSize: 'clamp(24px, 8cqmin, 72px)' }}>
          {code}
        </div>
      ) : (
        <div className="text-base text-locked">Ask the presenter</div>
      )}
    </div>
  );
}
