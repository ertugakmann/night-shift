// The player's own record: the best night's care score. Kept by the server, across nights (R does not touch
// it), and saved to a small file so a restart of the laptop server keeps it too. Only the presenter can clear
// it (B, twice). On Render the file lasts until the next deploy or restart, which is fine for a demo day.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface RecordState {
  /** The best night so far, or null. */
  best: number | null;
  /** The best before the night that just ended (so the card can say "New record!"); null if there was none. */
  previous: number | null;
}

export class BestRecord {
  private best: number | null = null;
  private previous: number | null = null;
  /** The night (report key) already counted, so a night is never counted twice. */
  private counted: string | null = null;

  constructor(private readonly file: string) {
    try {
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as { best?: unknown };
        if (typeof saved.best === 'number' && Number.isFinite(saved.best)) this.best = saved.best;
      }
    } catch (err) {
      console.warn(`Record file ${file} unreadable, starting without a record:`, err);
    }
  }

  get state(): RecordState {
    return { best: this.best, previous: this.previous };
  }

  /** A night has ended with this care score. Returns true if it is a new record. */
  count(key: string, care: number): boolean {
    if (this.counted === key) return false;
    this.counted = key;
    this.previous = this.best;
    const fresh = this.best === null || care > this.best;
    if (fresh) {
      this.best = care;
      this.save();
    }
    return fresh;
  }

  /** A new night has begun (reset): the next ending counts, even if it is the very same seeded night. */
  nextNight(): void {
    this.counted = null;
  }

  clear(): void {
    this.best = null;
    this.previous = null;
    this.save();
  }

  private save(): void {
    try {
      writeFileSync(this.file, JSON.stringify({ best: this.best }));
    } catch (err) {
      console.warn(`Could not save the record to ${this.file}:`, err);
    }
  }
}
