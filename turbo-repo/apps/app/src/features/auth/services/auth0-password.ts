import "server-only";

import { CredentialsSignin } from "next-auth";
import type { User } from "next-auth";
import type { SignInCredentials } from "./auth.service.types";
import { getCredentialsConnection } from "@/features/auth/config/auth0-connections";
import { logger } from "@/lib/logger";

type Auth0TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type IdTokenClaims = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
};

/** Decodes a JWT payload without verifying the signature. Safe here because
 * the token comes straight from the Auth0 token endpoint over TLS. */
function decodeJwtPayload(token: string): IdTokenClaims {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Malformed id_token");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/**
 * Token fields to persist for a credentials sign-in. Auth0-authenticated users
 * carry an id_token and get the same JWT-shaped token as OAuth users (so the
 * session/refresh/Bearer-forwarding paths treat them identically); legacy
 * Alfresco users keep the ticket-shaped token.
 */
export function tokenFieldsForCredentialsUser(user: User): {
  rawJWT?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  ticket?: string;
} {
  if (user.idToken) {
    return {
      rawJWT: user.idToken,
      accessTokenExpiresAt: user.expiresAt,
      refreshToken: user.refreshToken,
      ticket: undefined,
    };
  }
  return {
    ticket: user.ticket,
    rawJWT: undefined,
  };
}

/**
 * Validates username/password against the Auth0 database connection using the
 * password-realm grant, so credentials users get the same JWT-shaped session
 * as users brokered through Auth0 social connections (Google, Entra ID, ...).
 *
 * Requires the Password grant to be enabled on the Auth0 application.
 */
export async function authenticateWithAuth0Password(
  credentials: SignInCredentials
): Promise<User> {
  try {
    const response = await fetch(
      new URL("/oauth/token", process.env.AUTH_AUTH0_ISSUER).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "http://auth0.com/oauth/grant-type/password-realm",
          realm: getCredentialsConnection(),
          username: credentials.email,
          password: credentials.password,
          client_id: process.env.AUTH_AUTH0_ID,
          client_secret: process.env.AUTH_AUTH0_SECRET,
          ...(process.env.AUTH_AUTH0_AUDIENCE && {
            audience: process.env.AUTH_AUTH0_AUDIENCE,
          }),
          scope: "openid profile email offline_access",
        }),
      }
    );

    if (!response.ok) {
      const error: unknown = await response.json().catch(() => undefined);
      logger.warn(
        { status: response.status, error },
        "Auth0 password-realm grant rejected"
      );
      throw new CredentialsSignin("Invalid credentials");
    }

    const tokens = (await response.json()) as Auth0TokenResponse;
    const claims = decodeJwtPayload(tokens.id_token);

    return {
      id: claims.sub ?? credentials.email,
      name: claims.name || claims.email || credentials.email,
      email: claims.email ?? credentials.email,
      image: claims.picture,
      groups: [],
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      throw error;
    }
    logger.error({ error }, "Auth0 password-realm sign-in failed");
    throw new CredentialsSignin("Invalid credentials");
  }
}
