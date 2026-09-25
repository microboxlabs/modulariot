/**
 * A short-lived cache in front of a host lookup.
 *
 * Scope membership is consulted once per request and ticket validation once
 * per request, so without a cache the host's own service sees this server's
 * entire traffic. With one it sees a request per key per interval.
 *
 * Three rules, each of which changes what an operator has to reason about:
 *
 * - A "yes" and a "no" expire on separate clocks. A stale yes keeps a revoked
 *   member working; a stale no keeps a new member locked out. They are
 *   different risks, so they are different settings.
 * - A failure is never cached. Caching one would turn a moment of downtime
 *   into a fixed period of refusing everybody, outlasting the outage.
 * - Concurrent lookups of the same key share one call, so a burst of requests
 *   from one caller is one question to the host.
 */

export interface LookupCacheOptions<I, V> {
  /**
   * Answers for one input. Kept separate from the key so a key can be a hash
   * of something the loader still needs in full — a ticket, for instance,
   * which should not sit in a long-lived table in the clear.
   */
  load: (input: I) => Promise<V | null>;
  /** How long an answer is reused. */
  ttlMs: number;
  /** How long a "no" is reused. */
  negativeTtlMs: number;
  /**
   * Distinct keys held at once. Keys carry caller-supplied parts — a scope id
   * from a URL, a ticket from a header — so an unbounded table is a caller
   * deciding how much this process retains.
   */
  maxEntries: number;
  now?: () => number;
}

interface Entry<V> {
  value: V | null;
  expiresAt: number;
}

export function createLookupCache<I, V>(
  options: LookupCacheOptions<I, V>,
): (key: string, input: I) => Promise<V | null> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry<V>>();
  const inFlight = new Map<string, Promise<V | null>>();

  function remember(key: string, value: V | null): void {
    entries.set(key, {
      value,
      expiresAt:
        now() + (value === null ? options.negativeTtlMs : options.ttlMs),
    });
    while (entries.size > options.maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }
  }

  return async function lookup(key: string, input: I): Promise<V | null> {
    const cached = entries.get(key);
    if (cached !== undefined && now() < cached.expiresAt) return cached.value;
    // Dropping the expired entry before reloading it is what re-dates it in
    // the insertion order that eviction reads. `Map.set` on a key already
    // present leaves it where it was, so without this the key asked for most
    // often is the one evicted first.
    if (cached !== undefined) entries.delete(key);

    const pending = inFlight.get(key);
    if (pending !== undefined) return pending;

    const call = options
      .load(input)
      .then((value) => {
        remember(key, value);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, call);
    return call;
  };
}
