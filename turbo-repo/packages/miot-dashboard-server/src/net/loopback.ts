/**
 * Whether a host reaches only this machine.
 *
 * Two security checks depend on this answer: the bind address the unverified
 * header resolver is confined to, and the one exemption from requiring https
 * on a JWKS URL. Both were written as `host.startsWith("127.")`, which is a
 * prefix test on a name rather than a test on an address — `127.attacker.test`
 * passes it. A name is not an address: it is resolved by whoever answers DNS,
 * so neither check may accept one.
 */

/** Strips the brackets an IPv6 literal wears inside a URL. */
function stripBrackets(host: string): string {
  return host.length >= 2 && host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

/** An IPv4 literal in dotted-quad form. Shorthands like `127.1` are not one. */
function ipv4Octets(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    // A leading zero makes an octet octal to some parsers and decimal to
    // others, and then the two disagree about which address this is.
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

/**
 * The canonical spelling of an IPv6 literal, or null if it is not one.
 *
 * `new URL` does the normalising, so `0:0:0:0:0:0:0:1` and `::1` become the
 * same string. Written by hand this is a pattern with a nested quantifier over
 * a value from configuration, which is the shape that already produced one
 * high-severity finding in this package.
 */
function canonicalIpv6(address: string): string | null {
  if (!address.includes(":")) return null;
  try {
    return new URL(`http://[${address}]/`).hostname;
  } catch {
    return null;
  }
}

/** `::1`, and the IPv4-mapped form of 127.0.0.1, as `new URL` writes them. */
const IPV6_LOOPBACK = new Set(["[::1]", "[::ffff:7f00:1]"]);

/**
 * True only for a literal loopback address, or the name `localhost`.
 *
 * Deliberately strict: `127.1` is a loopback address as far as the C resolver
 * is concerned and is still refused here. A refusal costs an operator one
 * clearer spelling; an acceptance is a control that did not hold.
 */
export function isLoopbackHost(host: string): boolean {
  const address = stripBrackets(host.trim().toLowerCase());
  if (address === "localhost") return true;

  const octets = ipv4Octets(address);
  if (octets !== null) return octets[0] === 127;

  const canonical = canonicalIpv6(address);
  return canonical !== null && IPV6_LOOPBACK.has(canonical);
}
