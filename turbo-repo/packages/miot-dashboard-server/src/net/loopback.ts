/**
 * Whether a host reaches only this machine.
 *
 * Two security checks depend on this: the bind address the unverified header
 * resolver is confined to, and the one exemption from requiring https on a
 * JWKS URL. Both were written as `host.startsWith("127.")`, which accepts the
 * DNS name `127.attacker.test`. A name is resolved by whoever answers DNS, so
 * neither check may accept one.
 */

/** Strips the brackets an IPv6 literal has inside a URL. */
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
    // A leading zero means octal to some parsers and decimal to others, so the
    // two disagree about which address this is.
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
 * `new URL` does the normalising, so `0:0:0:0:0:0:0:1` and `::1` produce the
 * same string. Written by hand this needs a pattern with a nested quantifier
 * over a configuration value, which produced a high-severity ReDoS finding in
 * this package before.
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
 * `127.1` is a loopback address to the C resolver and is refused here anyway.
 * Rejecting it costs an operator one clearer spelling; accepting a form this
 * function cannot parse exactly would defeat the check.
 */
export function isLoopbackHost(host: string): boolean {
  const address = stripBrackets(host.trim().toLowerCase());
  if (address === "localhost") return true;

  const octets = ipv4Octets(address);
  if (octets !== null) return octets[0] === 127;

  const canonical = canonicalIpv6(address);
  return canonical !== null && IPV6_LOOPBACK.has(canonical);
}
