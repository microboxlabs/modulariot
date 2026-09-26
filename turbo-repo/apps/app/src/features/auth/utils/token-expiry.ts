/**
 * Reads the `exp` claim (epoch seconds) from a JWT without verifying it.
 * Returns undefined when the token is missing or malformed.
 */
export function jwtExpiresAt(jwt?: string): number | undefined {
  const payload = jwt?.split(".")[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const exp = JSON.parse(atob(base64)).exp;
    return typeof exp === "number" ? exp : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Epoch seconds when the session can no longer call the backends.
 *
 * ECM and the other backends receive `rawJWT` (the Auth0 id_token), which can
 * expire before the access token. The session ends at whichever expires first.
 */
export function sessionExpiresAt(accessTokenExpiresAt?: number, rawJWT?: string): number {
  const candidates = [Number(accessTokenExpiresAt ?? 0), jwtExpiresAt(rawJWT) ?? 0].filter((v) => v > 0);
  return candidates.length > 0 ? Math.min(...candidates) : 0;
}
