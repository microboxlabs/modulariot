export interface EntraTokenRotationResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token?: string;
}

export interface EntraTokenRotationParams {
  issuer: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  scope?: string;
}

export interface EntraJwtLikeToken {
  [key: string]: unknown;
  accessToken?: string;
  rawJWT?: string;
  idToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number; // epoch seconds
  // Optional error flag propagated to session
  error?: "RefreshTokenError";
}
