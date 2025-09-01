import { Logger } from "@/lib/logger";
import { logTokenPreviews } from "./entra-token.logger";
import type {
  EntraJwtLikeToken,
  EntraTokenRotationParams,
  EntraTokenRotationResponse,
} from "./entra-token.types";

export function buildTokenEndpoint(issuer: string): string {
  // issuer expected like https://login.microsoftonline.com/<TENANT_ID>/v2.0
  return `${issuer.replace(/\/v2\.0$/, "")}/oauth2/v2.0/token`;
}

export function shouldRefresh(expiresAt?: number, _logger?: Logger): boolean {
  if (!expiresAt) return false;
  // Refresh 5 minutes (300s) before expiry to prevent session invalidation
  return Date.now() >= (expiresAt - 300) * 1000;
  // var date = new Date((expiresAt - 58 * 60) * 1000);
  // const ret = Date.now() >= date.getTime();
  // logger?.debug(
  //   { expiresAt: `${expiresAt}`, date: date.toISOString(), ret },
  //   "shouldRefresh"
  // );
  // console.log("shouldRefresh", { date: date.toISOString(), ret });
  // return ret;
}

export async function refreshAccessToken(
  params: EntraTokenRotationParams,
  logger?: Logger
): Promise<EntraTokenRotationResponse> {
  const { issuer, clientId, clientSecret, refreshToken, scope } = params;
  const tokenEndpoint = buildTokenEndpoint(issuer);

  logger?.debug(
    { tokenEndpoint, hasScope: !!scope },
    "Refreshing access token"
  );

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      ...(scope ? { scope } : {}),
    }),
  });

  if (!response.ok) {
    logger?.error({ status: response.status }, "Refresh request failed");
    throw new Error("RefreshTokenError");
  }

  const body = (await response.json()) as EntraTokenRotationResponse;

  logTokenPreviews("Refreshed tokens (previews)", {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    idToken: body.id_token,
  });
  return body;
}

export function persistRotationOnJwt(
  jwt: EntraJwtLikeToken,
  rotated: EntraTokenRotationResponse
): EntraJwtLikeToken {
  return {
    ...jwt,
    accessToken: rotated.access_token,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000 + rotated.expires_in),
    refreshToken:
      rotated.refresh_token ?? (jwt.refreshToken as string | undefined),
  };
}
