import { entraTokenLogger, logTokenPreviews } from "./entra-token.logger";
import type {
  EntraJwtLikeToken,
  EntraTokenRotationParams,
  EntraTokenRotationResponse,
} from "./entra-token.types";

export function buildTokenEndpoint(issuer: string): string {
  // issuer expected like https://login.microsoftonline.com/<TENANT_ID>/v2.0
  return `${issuer.replace(/\/v2\.0$/, "")}/oauth2/v2.0/token`;
}

export function shouldRefresh(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  // Refresh 5 minutes (300s) before expiry to prevent session invalidation
  return Date.now() >= (expiresAt - 300) * 1000;
  // var date = new Date((expiresAt - 58 * 60) * 1000);
  // const ret = Date.now() >= date.getTime();
  // console.log("shouldRefresh", { date: date.toISOString(), ret });
  // return ret;
}

export async function refreshAccessToken(
  params: EntraTokenRotationParams
): Promise<EntraTokenRotationResponse> {
  const { issuer, clientId, clientSecret, refreshToken, scope } = params;
  const tokenEndpoint = buildTokenEndpoint(issuer);

  entraTokenLogger.debug(
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
    entraTokenLogger.error(
      { status: response.status },
      "Refresh request failed"
    );
    throw new Error("RefreshTokenError");
  }

  const json: unknown = await response.json();

  const body = json as Partial<{
    access_token: unknown;
    id_token: unknown;
    expires_in: unknown;
    refresh_token?: unknown;
  }>;
  const accessTokenValue =
    typeof body.access_token === "string" ? body.access_token : undefined;
  const expiresInValue =
    typeof body.expires_in === "number"
      ? body.expires_in
      : Number(body.expires_in);
  const refreshTokenValue =
    typeof body.refresh_token === "string" ? body.refresh_token : undefined;
  const idTokenValue =
    typeof body.id_token === "string" ? body.id_token : undefined;
  if (!accessTokenValue || !expiresInValue || Number.isNaN(expiresInValue)) {
    entraTokenLogger.error({ body }, "Unexpected token response shape");
    throw new Error("RefreshTokenError");
  }
  if (!idTokenValue || !expiresInValue || Number.isNaN(expiresInValue)) {
    entraTokenLogger.error({ body }, "Unexpected token response shape");
    throw new Error("RefreshTokenError");
  }

  const rotated: EntraTokenRotationResponse = {
    access_token: accessTokenValue,
    id_token: idTokenValue,
    expires_in: expiresInValue,
    refresh_token: refreshTokenValue,
  };

  logTokenPreviews("Refreshed tokens (previews)", {
    accessToken: rotated.access_token,
    refreshToken: rotated.refresh_token,
    idToken: rotated.id_token,
  });

  return rotated;
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
