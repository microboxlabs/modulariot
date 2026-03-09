import { lookup } from "node:dns/promises";

const BLOCKED_IPV4_RANGES = [
  { prefix: "127.", mask: 8 },       // loopback
  { prefix: "10.", mask: 8 },        // private class A
  { prefix: "0.", mask: 8 },         // "this" network
  { prefix: "169.254.", mask: 16 },  // link-local
  { prefix: "192.168.", mask: 16 },  // private class C
];

function isPrivateIPv4(ip: string): boolean {
  if (BLOCKED_IPV4_RANGES.some((r) => ip.startsWith(r.prefix))) return true;
  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  const parts = ip.split(".");
  if (parts[0] === "172") {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

/**
 * Validates a URL is safe for server-side fetch (SSRF protection).
 * Rejects non-http(s) schemes and hostnames that resolve to private/loopback IPs.
 */
export async function validateTargetUrl(
  rawUrl: string
): Promise<{ valid: true } | { valid: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Only http and https URLs are allowed" };
  }

  const hostname = parsed.hostname;

  // Reject IP literals directly
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return { valid: false, reason: "URL resolves to a disallowed address" };
  }

  // DNS lookup to catch names that resolve to private IPs
  try {
    const { address } = await lookup(hostname);
    if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
      return { valid: false, reason: "URL resolves to a disallowed address" };
    }
  } catch {
    return { valid: false, reason: "Could not resolve hostname" };
  }

  return { valid: true };
}
