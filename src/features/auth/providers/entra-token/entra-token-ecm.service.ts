import type { Account, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { entraTokenLogger, logTokenPreviews } from "./entra-token.logger";
import type {
  EntraJwtLikeToken,
  EntraTokenRotationParams,
} from "./entra-token.types";
import {
  getRefreshTokens,
  putRefreshToken,
  type RefreshTokenRequest,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  refreshAccessToken as originalRefreshAccessToken,
  shouldRefresh,
} from "./entra-token.service";

const ENTRA_ID_PROVIDER = "entraId";

/**
 * Process Microsoft Entra ID account during sign-in
 * @param token - Current JWT token
 * @param account - OAuth account from Microsoft
 * @param user - User data
 * @returns Updated JWT token
 */
export async function processMicrosoftEntraAccount(
  token: JWT,
  account: Account,
  user: User
): Promise<JWT> {
  try {
    entraTokenLogger.debug(
      {
        accountId: account.providerAccountId,
        hasIdToken: !!account.id_token,
        hasAccessToken: !!account.access_token,
        hasRefreshToken: !!account.refresh_token,
        idTokenLength: account.id_token?.length,
        accessTokenLength: account.access_token?.length,
        refreshTokenLength: account.refresh_token?.length,
      },
      "Processing Microsoft Entra ID account"
    );

    // Raw JWT token from Microsoft Entra ID
    token.rawJWT = account.id_token;
    token.ticket = undefined;
    token.accessToken = undefined;
    token.refreshToken = undefined;

    // Persist provider access token expiry if available
    if (typeof account?.expires_at === "number") {
      token.accessTokenExpiresAt = account.expires_at as number;
    } else if (typeof account?.expires_in === "number") {
      token.accessTokenExpiresAt = Math.floor(
        Date.now() / 1000 + (account.expires_in as number)
      );
    }

    // Store initial refresh token in ECM (async, don't block sign-in)
    if (account.refresh_token && user) {
      // Create a minimal session for ECM API call
      const tempSession = {
        user: {
          id: user.id,
          email: user.email,
          ticket: user.ticket,
          rawJWT: account.id_token,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
      } as Session;

      storeInitialRefreshToken(tempSession, account.refresh_token).catch(
        (error) => {
          entraTokenLogger.warn(
            "Failed to store initial refresh token in ECM",
            { error: error as Error }
          );
        }
      );
    }

    entraTokenLogger.debug(
      {
        accessTokenPreview: account.access_token?.slice(0, 16),
        refreshTokenPreview: account.refresh_token?.slice(0, 16),
        refreshTokenStoredInEcm: !!account.refresh_token,
      },
      "Stored provider tokens (rawJWT in token, refresh in ECM)"
    );

    entraTokenLogger.debug(
      {
        rawJWT: token.rawJWT,
        ticket: token.ticket,
      },
      "Tokens stored in JWT callback successfully"
    );

    return token;
  } catch (error) {
    entraTokenLogger.error("Error processing Microsoft Entra ID account", {
      error,
    });
    throw error;
  }
}

/**
 * Process token refresh for OAuth tokens
 * @param token - Current JWT token
 * @returns Updated JWT token or original token if no refresh needed
 */
export async function processTokenRefresh(
  token: JWT
): Promise<EntraJwtLikeToken> {
  try {
    // Check if we need to refresh based on rawJWT and expiry
    if (
      token.rawJWT &&
      shouldRefresh(token.accessTokenExpiresAt as number | undefined)
    ) {
      entraTokenLogger.debug(
        "Token refresh needed, starting ECM-backed refresh"
      );

      // Create session for ECM API calls
      const currentSession = {
        user: {
          id: token.sub,
          email: token.email,
          ticket: token.ticket,
          rawJWT: token.rawJWT,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as Session;

      const resource = process.env.AUTH_MICROSOFT_ENTRA_RESOURCE_URI;
      const scope = resource
        ? `openid profile offline_access ${resource}/.default`
        : "openid profile offline_access";

      const rotationParams = {
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
        refreshToken: "", // Will be retrieved from ECM
        scope,
      };

      const updatedToken = await refreshAccessTokenWithEcmPersistence(
        token,
        rotationParams,
        currentSession
      );

      entraTokenLogger.debug(
        "Successfully refreshed tokens using ECM persistence"
      );
      return updatedToken;
    }

    return { ...token, idToken: token.rawJWT };
  } catch (error) {
    entraTokenLogger.error(
      "Error refreshing access_token with ECM persistence",
      error
    );
    return { ...token, error: "RefreshTokenError" };
  }
}

/**
 * Enhanced refresh logic that uses ECM as persistent storage for refresh tokens
 * @param jwt - Current JWT token
 * @param params - Token rotation parameters
 * @param session - User session for ECM API calls
 * @returns Updated JWT token with new tokens
 */
export async function refreshAccessTokenWithEcmPersistence(
  jwt: EntraJwtLikeToken,
  params: EntraTokenRotationParams,
  session: Session
): Promise<EntraJwtLikeToken> {
  try {
    entraTokenLogger.debug("Starting ECM-backed token refresh");

    // First, try to get the refresh token from ECM
    let refreshToken = params.refreshToken;

    // If no refresh token provided, try to get it from ECM
    if (!refreshToken) {
      try {
        const ecmTokens = await getRefreshTokens(session, ENTRA_ID_PROVIDER);
        if (ecmTokens.tokens && ecmTokens.tokens.length > 0) {
          refreshToken = ecmTokens.tokens[0]; // Use the first available token
          entraTokenLogger.debug("Retrieved refresh token from ECM storage");
        }
      } catch (error) {
        entraTokenLogger.warn("Failed to retrieve refresh token from ECM", {
          error,
        });
      }
    }

    if (!refreshToken) {
      entraTokenLogger.error("No refresh token available for rotation");
      throw new Error("RefreshTokenError");
    }

    // Perform the actual token refresh with Microsoft
    const rotated = await originalRefreshAccessToken({
      ...params,
      refreshToken,
    });

    entraTokenLogger.debug("Successfully refreshed tokens with Microsoft");

    // If we got a new refresh token, store it in ECM
    if (rotated.refresh_token) {
      try {
        const storeRequest: RefreshTokenRequest = {
          provider: ENTRA_ID_PROVIDER,
          mode: "replace", // Replace existing tokens
          tokens: [rotated.refresh_token],
        };

        await putRefreshToken(session, storeRequest);
        entraTokenLogger.debug("Stored new refresh token in ECM");
      } catch (error) {
        entraTokenLogger.warn("Failed to store refresh token in ECM", {
          error,
        });
        // Don't fail the entire refresh process if storage fails
      }
    }

    // Update the JWT with new tokens
    const updatedJwt: EntraJwtLikeToken = {
      ...jwt,
      accessToken: rotated.access_token,
      idToken: rotated.id_token,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000 + rotated.expires_in),
      // Don't store refresh token in JWT anymore - it's in ECM
      refreshToken: undefined,
    };

    logTokenPreviews("ECM-backed refresh completed", {
      accessToken: rotated.access_token,
      refreshToken: rotated.refresh_token,
    });

    return updatedJwt;
  } catch (error) {
    entraTokenLogger.error("ECM-backed token refresh failed", { error });
    throw error;
  }
}

/**
 * Store initial refresh token in ECM during sign-in
 * @param session - User session for ECM API calls
 * @param refreshToken - Refresh token to store
 */
export async function storeInitialRefreshToken(
  session: Session,
  refreshToken: string
): Promise<void> {
  try {
    const storeRequest: RefreshTokenRequest = {
      provider: ENTRA_ID_PROVIDER,
      mode: "replace", // Append to existing tokens
      token: refreshToken,
    };

    await putRefreshToken(session, storeRequest);
    entraTokenLogger.debug("Stored initial refresh token in ECM");
  } catch (error) {
    entraTokenLogger.error("Failed to store initial refresh token in ECM", {
      error,
    });
    // Don't fail sign-in if storage fails
  }
}

/**
 * Clean up refresh tokens from ECM (e.g., on sign-out)
 * @param session - User session for ECM API calls
 */
export async function cleanupRefreshTokens(session: Session): Promise<void> {
  try {
    const storeRequest: RefreshTokenRequest = {
      provider: ENTRA_ID_PROVIDER,
      mode: "replace",
      tokens: [], // Empty array to clear all tokens
    };

    await putRefreshToken(session, storeRequest);
    entraTokenLogger.debug("Cleaned up refresh tokens from ECM");
  } catch (error) {
    entraTokenLogger.warn("Failed to cleanup refresh tokens from ECM", {
      error,
    });
  }
}
