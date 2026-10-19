import type { Session } from "next-auth";

/** The token backends accept for calls made on behalf of the session user. */
export function sessionToken(
  session: Session | null | undefined
): string | undefined {
  return session?.user?.rawJWT;
}

/**
 * The `Authorization` header for calls made on behalf of the session user.
 * Empty when the session has no token, so it can be spread into any headers.
 */
export function sessionAuthHeader(
  session: Session | null | undefined
): Record<string, string> {
  const token = sessionToken(session);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
