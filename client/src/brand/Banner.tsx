// The MoSAIcSOC · Co-funded by the European Union · ECCC banner, the project's own artwork.
// One file, loaded from one place: to use a sharper copy, replace client/public/brand/mosaicsoc-banner.png
// (same name) and rebuild. It is always shown exactly as it is: no recolouring, no filters, no cropping,
// its own proportions ("contain" / "meet" fit it inside whatever box it is given).
import type { CSSProperties } from 'react';

export const BANNER_SRC = '/brand/mosaicsoc-banner.png';
export const BANNER_ALT = 'MoSAIcSOC: Modular Operational Security with AI-powered Intelligence and Collaboration for Security Operations Centers. Co-funded by the European Union. ECCC, European Cybersecurity Competence Centre.';

/** For HTML: fits inside its box, never stretched or cut. */
export function BannerImg({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <img src={BANNER_SRC} alt={BANNER_ALT} draggable={false} className={`block select-none object-contain ${className}`} style={style} />;
}

/** For SVG scenes: fits inside the given box, never stretched or cut. */
export function BannerSvg({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <image href={BANNER_SRC} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet">
      <title>{BANNER_ALT}</title>
    </image>
  );
}

/** Screen 5: a thin strip along the bottom, always there, in both views. */
export function BannerStrip() {
  return (
    <div className="flex shrink-0 items-center justify-center bg-[#0c0922]" style={{ height: '6%' }}>
      <BannerImg className="h-[78%] w-auto max-w-[96%]" />
    </div>
  );
}

/** Shift start: on the black screen, like the studio logos before a film. Fades in and out. */
export function IntroBanner({ t, from, to }: { t: number; from: number; to: number }) {
  if (t < from || t >= to) return null;
  const fade = 600;
  const opacity = Math.min(1, (t - from) / fade, (to - t) / fade);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: Math.max(0, opacity) }}>
      <BannerImg className="h-auto w-[62%] max-w-[1100px]" />
    </div>
  );
}
