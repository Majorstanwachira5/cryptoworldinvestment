import fs from "fs";
import path from "path";

/**
 * Durable storage for platform state.
 *
 * The store used to live only in process memory, so every restart silently
 * deleted all accounts, balances, trades, and referrals. That is unacceptable
 * for anything that represents money, so state is written to disk.
 *
 * Writes are atomic: the payload goes to a temporary file which is then
 * renamed over the target. A crash mid-write therefore leaves the previous
 * complete file intact rather than a truncated one.
 *
 * Writes are also debounced. Price marks arrive from every open position on a
 * timer, so writing synchronously on each one would hammer the disk; instead
 * a dirty flag schedules a single write shortly after the burst settles.
 * Critical mutations call `flush()` to force the write immediately.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

const DEBOUNCE_MS = 400;

const dirty = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function ensureDir(): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

function fileFor(name: string): string {
  return path.join(ensureDir(), `${name}.json`);
}

export function loadState<T>(name: string): T | null {
  try {
    const file = fileFor(name);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    // A corrupt or unreadable file must not take the server down. The caller
    // falls back to a fresh store and the bad file is preserved for inspection.
    console.error(`[db] could not read ${name}.json:`, (error as Error).message);
    return null;
  }
}

function writeNow<T>(name: string, value: T): void {
  const file = fileFor(name);
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value), "utf8");
    fs.renameSync(tmp, file);
  } catch (error) {
    console.error(`[db] could not persist ${name}:`, (error as Error).message);
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* nothing further to do */
    }
  }
}

/** Schedules a write for `name`, coalescing bursts into one. */
export function saveState<T>(name: string, value: T): void {
  dirty.add(name);

  const existing = timers.get(name);
  if (existing) clearTimeout(existing);

  timers.set(
    name,
    setTimeout(() => {
      timers.delete(name);
      dirty.delete(name);
      writeNow(name, value);
    }, DEBOUNCE_MS)
  );
}

/** Forces any pending write for `name` to complete now. */
export function flushState<T>(name: string, value: T): void {
  const existing = timers.get(name);
  if (existing) {
    clearTimeout(existing);
    timers.delete(name);
  }
  dirty.delete(name);
  writeNow(name, value);
}

/**
 * Reports whether the data directory is writable.
 *
 * Checked on boot so a misconfigured volume is visible in the logs instead of
 * surfacing later as silently lost state.
 */
export function describeStorage(): { dir: string; writable: boolean; error?: string } {
  try {
    ensureDir();
    const probe = path.join(DATA_DIR, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return { dir: DATA_DIR, writable: true };
  } catch (error) {
    return { dir: DATA_DIR, writable: false, error: (error as Error).message };
  }
}