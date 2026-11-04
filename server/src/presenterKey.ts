import { randomBytes } from 'node:crypto';

/** Local-only default, so ?presenter=nightshift-dev keeps working across dev-server restarts. */
export const DEV_PRESENTER_KEY = 'nightshift-dev';

export type KeySource = 'env' | 'dev-default' | 'one-off';

/**
 * Which presenter key this server accepts.
 * - PRESENTER_KEY set (Render dashboard, or the local .env): that, and only that.
 * - Not set, running locally: the fixed dev default, so links survive restarts.
 * - Not set, running on Render (Render sets RENDER=true): never the dev default. A random one-off key
 *   is made and logged instead, so nobody can guess their way in.
 */
export function resolvePresenterKey(env: NodeJS.ProcessEnv): { key: string; source: KeySource } {
  const configured = env.PRESENTER_KEY?.trim();
  if (configured) return { key: configured, source: 'env' };
  if (!env.RENDER) return { key: DEV_PRESENTER_KEY, source: 'dev-default' };
  return { key: randomBytes(12).toString('base64url'), source: 'one-off' };
}
