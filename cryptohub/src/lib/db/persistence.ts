import fs from "fs";
import path from "path";
import os from "os";

/**
 * Durable storage for platform state.
 *
 * Supports persistent local storage with graceful serverless / Vercel
 * fallback using `/tmp` and in-memory caching. State is never lost during
 * runtime even if the primary directory is read-only.
 */

// In-memory cache ensures zero crashes if filesystem is read-only or in serverless warm containers
const memoryCache = new Map<string, unknown>();

let resolvedDataDir: string | null = null;

function resolveDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;

  const candidates: string[] = [];

  if (process.env.DATA_DIR) {
    candidates.push(process.env.DATA_DIR);
  }

  // On Vercel / serverless runtime, /tmp is the guaranteed writable directory
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    candidates.push(path.join("/tmp", "cryptohub-data"));
  }

  // Local development fallback
  candidates.push(path.join(process.cwd(), "data"));
  candidates.push(path.join(os.tmpdir(), "cryptohub-data"));
  candidates.push(path.join("/tmp", "cryptohub-data"));

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const probe = path.join(candidate, `.write-probe-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probe, "ok", "utf8");
      if (fs.existsSync(probe)) fs.unlinkSync(probe);

      resolvedDataDir = candidate;
      return candidate;
    } catch {
      continue;
    }
  }

  // Default fallback if no directory is writable
  resolvedDataDir = path.join(os.tmpdir(), "cryptohub-data");
  return resolvedDataDir;
}

const DEBOUNCE_MS = 400;

const dirty = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function ensureDir(): string {
  const dir = resolveDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    /* safely ignored; memoryCache serves state */
  }
  return dir;
}

function fileFor(name: string): string {
  return path.join(ensureDir(), `${name}.json`);
}

export function loadState<T>(name: string): T | null {
  if (memoryCache.has(name)) {
    return memoryCache.get(name) as T;
  }

  try {
    const file = fileFor(name);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as T;
    memoryCache.set(name, parsed);
    return parsed;
  } catch (error) {
    console.warn(`[db] could not read ${name}.json from disk:`, (error as Error).message);
    return null;
  }
}

function writeNow<T>(name: string, value: T): void {
  // Always update memoryCache immediately so instant reads reflect the new state
  memoryCache.set(name, value);

  try {
    const file = fileFor(name);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value), "utf8");
    fs.renameSync(tmp, file);
  } catch (error) {
    console.warn(`[db] disk write skipped for ${name} (using memory state):`, (error as Error).message);
  }
}

/** Schedules a write for `name`, coalescing bursts into one. */
export function saveState<T>(name: string, value: T): void {
  dirty.add(name);
  memoryCache.set(name, value);

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
 */
export function describeStorage(): { dir: string; writable: boolean; error?: string } {
  try {
    const dir = ensureDir();
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return { dir, writable: true };
  } catch (error) {
    return { dir: resolveDataDir(), writable: false, error: (error as Error).message };
  }
}
