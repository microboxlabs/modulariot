import { isIP } from "node:net";
const normalizeIp = (value) => value?.replace(/^::ffff:/, "");
/** Trust client identity only when the immediate peer is explicitly configured. */
export function clientAddress(req, trustedProxies) {
  const peer = normalizeIp(req.socket.remoteAddress) || "unknown";
  if (!trustedProxies.has(peer)) return peer;
  const header = req.headers["x-real-ip"];
  const client = typeof header === "string" ? normalizeIp(header) : undefined;
  return client && isIP(client) ? client : peer;
}
/** Bounded, expiring demo limiter. Use an ingress/shared limiter across replicas. */
export function createLoginLimiter({ now = Date.now, maxEntries = 2048 } = {}) {
  const failures = new Map();
  function prune() {
    for (const [ip, state] of failures)
      if (state.until <= now()) failures.delete(ip);
  }
  return {
    blocked(ip) {
      prune();
      return (failures.get(ip)?.count ?? 0) >= 20;
    },
    fail(ip) {
      prune();
      if (!failures.has(ip) && failures.size >= maxEntries)
        failures.delete(failures.keys().next().value);
      const state = failures.get(ip) ?? { count: 0, until: now() + 600000 };
      state.count += 1;
      failures.set(ip, state);
    },
    clear(ip) {
      failures.delete(ip);
    },
    get size() {
      prune();
      return failures.size;
    },
  };
}
