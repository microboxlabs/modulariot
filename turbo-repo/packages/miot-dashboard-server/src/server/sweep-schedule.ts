/**
 * Runs the orphan sweep on a timer.
 *
 * Its own module rather than a function inside `bin.ts` because `bin.ts` is an
 * entry point that starts a server when it loads, and this has two rules worth
 * a test: one sweep at a time, and shutdown waits for the one in flight.
 */

import type { SweepResult } from "../store/sweep";

export interface SweepScheduleOptions {
  sweep(olderThan: Date): Promise<SweepResult>;
  /** How often to sweep. Zero never sweeps at all. */
  intervalSeconds: number;
  /** An unreferenced document younger than this is a save in progress. */
  minAgeSeconds: number;
  log(line: Record<string, unknown>): void;
  now?: () => number;
}

/**
 * Start sweeping. Returns a function that stops the timer and waits for a
 * sweep already running, so a caller can close the store it reads from
 * without interrupting it.
 */
export function startSweepSchedule(
  options: SweepScheduleOptions,
): () => Promise<void> {
  const {
    sweep,
    intervalSeconds,
    minAgeSeconds,
    log,
    now = Date.now,
  } = options;
  if (intervalSeconds === 0) return () => Promise.resolve();

  const run = async (): Promise<void> => {
    try {
      const result = await sweep(new Date(now() - minAgeSeconds * 1_000));
      log({
        level: "info",
        msg: "orphan sweep",
        deleted: result.deleted.length,
        recent: result.recent,
        unknownAge: result.unknownAge,
        referenced: result.referenced,
        failed: result.failed.length,
      });
    } catch (error) {
      log({ level: "error", msg: "orphan sweep failed", error: String(error) });
    }
  };

  // One at a time. A sweep slower than the interval would otherwise be started
  // again on top of itself, and every run lists every document.
  let inFlight: Promise<void> | null = null;
  const runOnce = (): Promise<void> => {
    if (inFlight !== null) return inFlight;
    const started = run().finally(() => {
      if (inFlight === started) inFlight = null;
    });
    inFlight = started;
    return started;
  };

  const first = runOnce();
  // `unref` so the timer alone never keeps the process alive; it does not stop
  // the timer firing during shutdown, which is what the returned function is
  // for.
  const timer = setInterval(() => void runOnce(), intervalSeconds * 1_000);
  timer.unref();

  return async () => {
    clearInterval(timer);
    await first;
    await inFlight;
  };
}
