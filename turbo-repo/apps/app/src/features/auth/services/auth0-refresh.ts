import "server-only";

import { earliestTokenExpiry } from "./auth0-password";

type Auth0RefreshResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export type RefreshedTokens = {
  rawJWT?: string;
  accessToken?: string;
  refreshToken: string;
  expiresAt?: number;
};

export type RefreshResult =
  | { ok: true; tokens: RefreshedTokens }
  | { ok: false; status: number };

/** How long a failed refresh is reused before Auth0 is called again. */
const FAILURE_TTL_MS = 30_000;

const results = new Map<
  string,
  { result: Promise<RefreshResult>; expiresAtMs: number }
>();

async function requestRefresh(
  refreshToken: string,
  currentIdToken: string | undefined
): Promise<RefreshResult> {
  try {
    const response = await fetch(
      `${process.env.AUTH_AUTH0_ISSUER}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: process.env.AUTH_AUTH0_ID,
          client_secret: process.env.AUTH_AUTH0_SECRET,
          refresh_token: refreshToken,
        }),
      }
    );
    if (!response.ok) return { ok: false, status: response.status };

    const tokens = (await response.json()) as Auth0RefreshResponse;
    const rawJWT = tokens.id_token ?? currentIdToken;
    const accessTokenExpiresAt =
      tokens.expires_in === undefined
        ? undefined
        : Math.floor(Date.now() / 1000) + tokens.expires_in;
    return {
      ok: true,
      tokens: {
        rawJWT,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? refreshToken,
        expiresAt: earliestTokenExpiry(rawJWT, accessTokenExpiresAt),
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Exchanges a refresh token for new Auth0 tokens. Calls with the same refresh
 * token share one request and its result: `auth()` in route handlers does not
 * save the refreshed cookie, so without this every request from one page sends
 * the same refresh token to Auth0, which rotation rejects as reuse.
 */
export function refreshAuth0Tokens(
  refreshToken: string,
  currentIdToken: string | undefined
): Promise<RefreshResult> {
  const now = Date.now();
  for (const [key, entry] of results) {
    if (entry.expiresAtMs <= now) results.delete(key);
  }

  const cached = results.get(refreshToken);
  if (cached) return cached.result;

  const entry = {
    result: requestRefresh(refreshToken, currentIdToken),
    expiresAtMs: now + FAILURE_TTL_MS,
  };
  results.set(refreshToken, entry);
  void entry.result.then((result) => {
    entry.expiresAtMs =
      result.ok && result.tokens.expiresAt !== undefined
        ? result.tokens.expiresAt * 1000
        : Date.now() + FAILURE_TTL_MS;
  });
  return entry.result;
}
