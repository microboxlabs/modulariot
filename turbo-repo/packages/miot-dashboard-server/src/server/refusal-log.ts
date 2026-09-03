/**
 * Rate-limited logging of refused credentials.
 *
 * Every rejected token used to write a line. Now that the server is reachable,
 * that is one write per unauthenticated request: an anonymous caller controls
 * how much this process logs, and `process.stdout.write` buffers in memory
 * when whatever reads it cannot keep up.
 *
 * The reason is still recorded — a 401 carries no detail, so without it a
 * misconfiguration cannot be diagnosed — but at most one line per reason per
 * interval, carrying how many were folded into it.
 */

export interface RefusalLogOptions {
  write: (line: Record<string, unknown>) => void;
  /** Shortest gap between two lines for the same reason. */
  intervalMs?: number;
  now?: () => number;
}

/**
 * Distinct reasons tracked at once.
 *
 * Some reasons quote the token — the algorithm it claims, the key id it names
 * — so a caller can produce as many distinct ones as it likes. Without a cap
 * the table of reasons grows without bound, which is what this module exists
 * to prevent.
 */
const MAX_REASONS = 32;

/** What the overflow is counted under once the table is full. */
const OTHER = "other credential refusals";

interface Pending {
  loggedAt: number;
  suppressed: number;
}

export function createRefusalLog(
  options: RefusalLogOptions,
): (reason: string) => void {
  const intervalMs = options.intervalMs ?? 10_000;
  const now = options.now ?? Date.now;
  const seen = new Map<string, Pending>();

  return function refused(reason: string): void {
    const key = seen.has(reason) || seen.size < MAX_REASONS ? reason : OTHER;
    const at = now();
    const pending = seen.get(key);

    if (pending !== undefined && at - pending.loggedAt < intervalMs) {
      pending.suppressed += 1;
      return;
    }

    options.write({
      level: "warn",
      msg: "credential refused",
      reason: key,
      ...(pending && pending.suppressed > 0
        ? { alsoRefused: pending.suppressed }
        : {}),
    });
    seen.set(key, { loggedAt: at, suppressed: 0 });
  };
}
