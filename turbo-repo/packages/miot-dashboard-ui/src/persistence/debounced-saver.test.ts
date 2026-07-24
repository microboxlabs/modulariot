import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDebouncedDashboardSaver,
  stripEphemeralState,
} from "./debounced-saver";
import { DEFAULT_STORAGE } from "../types/dashboard";
import type { DashboardStore } from "../adapters/store";

const REF = { scopeId: "site-1", slug: "fleet" };

const editingConfig = () => ({
  ...DEFAULT_STORAGE,
  name: "Fleet",
  preferences: { editMode: true },
});

function makeStore(overrides: Partial<DashboardStore> = {}): DashboardStore {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("stripEphemeralState", () => {
  it("forces editMode false without touching the rest", () => {
    const stripped = stripEphemeralState(editingConfig());
    expect(stripped.preferences.editMode).toBe(false);
    expect(stripped.name).toBe("Fleet");
  });
});

describe("createDebouncedDashboardSaver", () => {
  it("coalesces schedules into one save with editMode stripped", async () => {
    const store = makeStore();
    const saver = createDebouncedDashboardSaver({ store, getRef: () => REF });

    saver.schedule({ ...editingConfig(), name: "v1" });
    saver.schedule({ ...editingConfig(), name: "v2" });
    expect(store.save).not.toHaveBeenCalled();
    expect(saver.hasPending()).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith(REF, {
      ...editingConfig(),
      name: "v2",
      preferences: { editMode: false },
    });
    expect(saver.hasPending()).toBe(false);
  });

  it("does nothing when getRef returns null", async () => {
    const store = makeStore();
    const saver = createDebouncedDashboardSaver({ store, getRef: () => null });
    saver.schedule(editingConfig());
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.save).not.toHaveBeenCalled();
    expect(saver.hasPending()).toBe(false);
  });

  it("resolves the ref at dispatch time, not schedule time", async () => {
    const store = makeStore();
    let ref: typeof REF | null = REF;
    const saver = createDebouncedDashboardSaver({ store, getRef: () => ref });
    saver.schedule(editingConfig());
    ref = { scopeId: "site-2", slug: "fleet" };
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.save).toHaveBeenCalledWith(
      { scopeId: "site-2", slug: "fleet" },
      expect.anything()
    );
  });

  it("retries with exponential backoff and recovers", async () => {
    const store = makeStore({
      save: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(undefined),
    });
    const onRetry = vi.fn();
    const saver = createDebouncedDashboardSaver({
      store,
      getRef: () => REF,
      onRetry,
    });

    saver.schedule(editingConfig());
    await vi.advanceTimersByTimeAsync(2000); // debounce fires, first save rejects
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, 1000);
    await vi.advanceTimersByTimeAsync(1000); // backoff elapses
    expect(store.save).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries and reports via onSaveError", async () => {
    const store = makeStore({
      save: vi.fn().mockRejectedValue(new Error("down")),
    });
    const onSaveError = vi.fn();
    const onRetry = vi.fn();
    const saver = createDebouncedDashboardSaver({
      store,
      getRef: () => REF,
      onRetry,
      onSaveError,
    });

    saver.schedule(editingConfig());
    await vi.advanceTimersByTimeAsync(2000); // attempt 1
    await vi.advanceTimersByTimeAsync(1000); // attempt 2 (backoff 1000)
    await vi.advanceTimersByTimeAsync(2000); // attempt 3 (backoff 2000)
    expect(store.save).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 2, 1000);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 3, 2000);
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });

  it("flush saves pending immediately", async () => {
    const store = makeStore();
    const saver = createDebouncedDashboardSaver({ store, getRef: () => REF });
    saver.schedule(editingConfig());
    await saver.flush();
    expect(store.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.save).toHaveBeenCalledTimes(1); // timer was cleared
  });

  it("teardown beacon-flushes pending via saveBeacon when available", () => {
    const saveBeacon = vi.fn();
    const store = makeStore({ saveBeacon });
    const saver = createDebouncedDashboardSaver({ store, getRef: () => REF });
    saver.schedule(editingConfig());
    saver.teardown();
    expect(saveBeacon).toHaveBeenCalledWith(REF, {
      ...editingConfig(),
      preferences: { editMode: false },
    });
    expect(store.save).not.toHaveBeenCalled();
  });

  it("teardown falls back to best-effort save without saveBeacon", () => {
    const store = makeStore({
      save: vi.fn().mockRejectedValue(new Error("teardown race")),
    });
    const saver = createDebouncedDashboardSaver({ store, getRef: () => REF });
    saver.schedule(editingConfig());
    expect(() => saver.teardown()).not.toThrow();
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("teardown with nothing pending is a no-op", () => {
    const saveBeacon = vi.fn();
    const store = makeStore({ saveBeacon });
    const saver = createDebouncedDashboardSaver({ store, getRef: () => REF });
    saver.teardown();
    expect(saveBeacon).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
});
