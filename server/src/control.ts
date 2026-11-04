import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { PRESENTER_ONLY, type CodeResult, type Hello, type IntentType, type Role } from '@night-shift/shared';

const MAX_FAILURES = 8;
const LOCKOUT_MS = 30_000;

/**
 * Who may act. Everyone can watch; the presenter always has control;
 * anyone who enters the current 4-digit code gets control too.
 * Pressing C (presenter) shows a fresh code; pressing C again hides it and revokes all extra control.
 */
export class Control {
  private presenters = new Set<string>();
  private controllers = new Set<string>();
  private failures = new Map<string, { count: number; lockedUntil: number }>();
  /** Current code, or null when hidden. Codes are only accepted while visible. */
  code: string | null = null;

  private presenterDigest: Buffer;

  constructor(presenterKey: string) {
    if (!presenterKey) throw new Error('Presenter key must not be empty');
    this.presenterDigest = digest(presenterKey);
  }

  get controllerCount(): number {
    return this.controllers.size;
  }

  role(socketId: string): Role {
    if (this.presenters.has(socketId)) return 'presenter';
    if (this.controllers.has(socketId)) return 'controller';
    return 'watcher';
  }

  /** Called on every (re)connect. A refreshed tab re-sends its stored code. */
  register(socketId: string, hello: Hello): Role {
    this.remove(socketId);
    if (this.isPresenterKey(hello.presenterKey)) this.presenters.add(socketId);
    else if (this.code !== null && hello.code === this.code) this.controllers.add(socketId);
    return this.role(socketId);
  }

  remove(socketId: string): void {
    this.presenters.delete(socketId);
    this.controllers.delete(socketId);
  }

  /** Returns an error message if this client may not perform the intent. */
  check(socketId: string, type: IntentType): string | null {
    const role = this.role(socketId);
    if (role === 'watcher') return 'Watching only. Enter the control code to take part.';
    if (role !== 'presenter' && PRESENTER_ONLY.includes(type)) return 'Only the presenter can do that.';
    return null;
  }

  /** Show a new code, or hide it and revoke everyone who joined with it. */
  toggleCode(): { visible: boolean; revoked: string[] } {
    if (this.code !== null) {
      const revoked = [...this.controllers];
      this.controllers.clear();
      this.code = null;
      return { visible: false, revoked };
    }
    this.code = String(randomInt(0, 10_000)).padStart(4, '0');
    return { visible: true, revoked: [] };
  }

  tryCode(socketId: string, sourceKey: string, input: unknown): CodeResult {
    const role = this.role(socketId);
    if (role !== 'watcher') return { ok: true, message: 'You already have control.' };

    const now = Date.now();
    const record = this.failures.get(sourceKey);
    if (record && record.lockedUntil > now) {
      return { ok: false, message: 'Too many wrong codes. Try again in a moment.' };
    }
    if (typeof input !== 'string' || !/^\d{4}$/.test(input)) {
      return { ok: false, message: 'The code is 4 digits.' };
    }
    if (this.code === null) {
      return { ok: false, message: 'No control code is active right now.' };
    }
    if (input !== this.code) {
      const count = (record?.count ?? 0) + 1;
      this.failures.set(sourceKey, {
        count: count >= MAX_FAILURES ? 0 : count,
        lockedUntil: count >= MAX_FAILURES ? now + LOCKOUT_MS : 0,
      });
      return { ok: false, message: 'Wrong code.' };
    }
    this.failures.delete(sourceKey);
    this.controllers.add(socketId);
    return { ok: true, message: 'You have control.' };
  }

  private isPresenterKey(key: string | null): boolean {
    if (typeof key !== 'string' || key.length === 0) return false;
    // Fixed-length digests compared in constant time, so response timing reveals nothing about the key.
    return timingSafeEqual(digest(key), this.presenterDigest);
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
