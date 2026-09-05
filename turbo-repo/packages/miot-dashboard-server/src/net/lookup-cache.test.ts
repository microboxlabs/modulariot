import { describe, expect, it, vi } from "vitest";
import { createLookupCache } from "./lookup-cache";

/** A clock the test moves by hand, so nothing waits on real time. */
function testClock(start = 1_000_000) {
  let at = start;
  return {
    now: () => at,
    advance: (ms: number) => {
      at += ms;
    },
  };
}

describe("createLookupCache", () => {
  it("asks once and reuses the answer", async () => {
    const load = vi.fn((input: string) => Promise.resolve(`role:${input}`));
    const lookup = createLookupCache({
      load,
      ttlMs: 1000,
      negativeTtlMs: 1000,
      maxEntries: 10,
    });

    await expect(lookup("k", "ops")).resolves.toBe("role:ops");
    await expect(lookup("k", "ops")).resolves.toBe("role:ops");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("asks again once the answer expires", async () => {
    const clock = testClock();
    const load = vi.fn(() => Promise.resolve("Editor"));
    const lookup = createLookupCache({
      load,
      ttlMs: 1000,
      negativeTtlMs: 1000,
      maxEntries: 10,
      now: clock.now,
    });

    await lookup("k", null);
    clock.advance(999);
    await lookup("k", null);
    expect(load).toHaveBeenCalledTimes(1);

    clock.advance(2);
    await lookup("k", null);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("expires a no on its own clock", async () => {
    // A stale yes keeps a revoked member working; a stale no keeps a new one
    // locked out. Sharing one setting would force a single answer to both.
    const clock = testClock();
    const load = vi.fn(() => Promise.resolve(null));
    const lookup = createLookupCache<null, string>({
      load,
      ttlMs: 60_000,
      negativeTtlMs: 1000,
      maxEntries: 10,
      now: clock.now,
    });

    await lookup("k", null);
    clock.advance(1001);
    await lookup("k", null);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never caches a failure", async () => {
    // Caching one turns a moment of downtime into a fixed period of refusing
    // everybody, outlasting the outage itself.
    const load = vi
      .fn<(input: null) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("host down"))
      .mockResolvedValue("Editor");
    const lookup = createLookupCache({
      load,
      ttlMs: 60_000,
      negativeTtlMs: 60_000,
      maxEntries: 10,
    });

    await expect(lookup("k", null)).rejects.toThrowError("host down");
    await expect(lookup("k", null)).resolves.toBe("Editor");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one call between concurrent lookups of the same key", async () => {
    let release: (value: string) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const lookup = createLookupCache({
      load,
      ttlMs: 1000,
      negativeTtlMs: 1000,
      maxEntries: 10,
    });

    const both = Promise.all([lookup("k", null), lookup("k", null)]);
    expect(load).toHaveBeenCalledTimes(1);
    release("Editor");
    await expect(both).resolves.toEqual(["Editor", "Editor"]);
  });

  it("does not share a call between different keys", async () => {
    const load = vi.fn((input: string) => Promise.resolve(input));
    const lookup = createLookupCache({
      load,
      ttlMs: 1000,
      negativeTtlMs: 1000,
      maxEntries: 10,
    });

    await Promise.all([lookup("a", "a"), lookup("b", "b")]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("passes the input through, so a key can be a digest", async () => {
    const load = vi.fn((input: string) => Promise.resolve(input.toUpperCase()));
    const lookup = createLookupCache({
      load,
      ttlMs: 1000,
      negativeTtlMs: 1000,
      maxEntries: 10,
    });

    await expect(lookup("sha256-of-the-ticket", "secret")).resolves.toBe(
      "SECRET",
    );
    expect(load).toHaveBeenCalledWith("secret");
  });

  it("holds no more than the configured number of keys", async () => {
    const load = vi.fn((input: string) => Promise.resolve(input));
    const lookup = createLookupCache({
      load,
      ttlMs: 60_000,
      negativeTtlMs: 60_000,
      maxEntries: 2,
    });

    await lookup("a", "a");
    await lookup("b", "b");
    await lookup("c", "c");
    // "a" was evicted, "c" is still held.
    await lookup("c", "c");
    expect(load).toHaveBeenCalledTimes(3);
    await lookup("a", "a");
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("keeps a key that is still being used", async () => {
    // Eviction is oldest-first by write. Without moving a refreshed key to the
    // end, the key being asked for most often is the one dropped.
    const clock = testClock();
    const load = vi.fn((input: string) => Promise.resolve(input));
    const lookup = createLookupCache({
      load,
      ttlMs: 100,
      negativeTtlMs: 100,
      maxEntries: 2,
      now: clock.now,
    });

    await lookup("a", "a");
    await lookup("b", "b");
    clock.advance(101);
    await lookup("a", "a"); // refreshed, so "b" is now the oldest
    await lookup("c", "c"); // evicts "b"
    load.mockClear();

    await lookup("a", "a");
    expect(load).not.toHaveBeenCalled();
  });
});
