/**
 * Rate-limited logging of refused credentials.
 *
 * Every rejected token used to write a line. Now that the server is meant to
 * be reachable, that is a write per unauthenticated request: an anonymous
 * caller decides how much this process logs, and `process.stdout.write`
 * buffers in memory when whatever is reading it cannot keep up.
 *
 * A line is still worth having — a 401 with no detail is right for the caller
 * and useless for whoever is on call — so the volume is capped rather than the
 * information. One line per reason per interval, carrying how many were
 * folded into it.
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
 * — so a caller can mint as many distinct ones as it likes. Without a cap the
 * table of reasons is itself the unbounded growth this module exists to stop.
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
