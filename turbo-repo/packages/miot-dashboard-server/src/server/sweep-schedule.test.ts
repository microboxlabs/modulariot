import { describe, expect, it, vi } from "vitest";
import type { SweepResult } from "../store/sweep";
import { startSweepSchedule } from "./sweep-schedule";

const EMPTY: SweepResult = {
  deleted: [],
  recent: 0,
  unknownAge: 0,
  referenced: 0,
  failed: [],
};

/** A sweep that does not resolve until the test says so. */
function pausedSweep() {
  let entered = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered: () => entered,
    release,
    sweep: async (): Promise<SweepResult> => {
      entered++;
      await gate;
      return EMPTY;
    },
  };
}

describe("startSweepSchedule", () => {
  it("does not start a second sweep while one is running", async () => {
    vi.useFakeTimers();
    const paused = pausedSweep();
    const stop = startSweepSchedule({
      sweep: paused.sweep,
      intervalSeconds: 1,
      minAgeSeconds: 60,
      log: () => {},
    });

    // Five intervals pass while the first sweep is still going.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(paused.entered()).toBe(1);

    paused.release();
    vi.useRealTimers();
    await stop();
  });

  it("waits for a sweep in flight before it returns", async () => {
    vi.useFakeTimers();
    const paused = pausedSweep();
    const stop = startSweepSchedule({
      sweep: paused.sweep,
      intervalSeconds: 1,
      minAgeSeconds: 60,
      log: () => {},
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(paused.entered()).toBe(1);

    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });

    // Still running, so stopping must not have finished. Closing the store
    // here is what would break the sweep half way through.
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);

    paused.release();
    vi.useRealTimers();
    await stopping;
    expect(stopped).toBe(true);
  });

  it("stops sweeping once stopped", async () => {
    vi.useFakeTimers();
    const sweep = vi.fn(async () => EMPTY);
    const stop = startSweepSchedule({
      sweep,
      intervalSeconds: 1,
      minAgeSeconds: 60,
      log: () => {},
    });
    await vi.advanceTimersByTimeAsync(2_500);
    const before = sweep.mock.calls.length;
    await stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sweep.mock.calls.length).toBe(before);
    vi.useRealTimers();
  });

  it("sweeps nothing when the interval is zero", async () => {
    const sweep = vi.fn(async () => EMPTY);
    const stop = startSweepSchedule({
      sweep,
      intervalSeconds: 0,
      minAgeSeconds: 60,
      log: () => {},
    });
    await stop();
    expect(sweep).not.toHaveBeenCalled();
  });

  it("subtracts the minimum age from now to get the cutoff", async () => {
    const sweep = vi.fn(async (_olderThan: Date) => EMPTY);
    const stop = startSweepSchedule({
      sweep,
      intervalSeconds: 3600,
      minAgeSeconds: 86_400,
      log: () => {},
      now: () => Date.parse("2026-09-08T12:00:00.000Z"),
    });
    await stop();
    expect(sweep.mock.calls[0]?.[0]).toEqual(
      new Date("2026-09-07T12:00:00.000Z"),
    );
  });

  it("keeps sweeping after one run throws", async () => {
    vi.useFakeTimers();
    const lines: Record<string, unknown>[] = [];
    let calls = 0;
    const stop = startSweepSchedule({
      sweep: async () => {
        calls++;
        if (calls === 1) throw new Error("the database went away");
        return EMPTY;
      },
      intervalSeconds: 1,
      minAgeSeconds: 60,
      log: (line) => lines.push(line),
    });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(calls).toBeGreaterThan(1);
    expect(lines[0]).toMatchObject({ level: "error" });
    vi.useRealTimers();
    await stop();
  });
});
