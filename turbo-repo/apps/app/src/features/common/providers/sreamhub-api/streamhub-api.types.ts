export interface TokenData {
  access_token: string;
  expires_in: number;
}

export interface AuthTokenConfig {
  clientId: string;
  clientSecret: string;
  audience: string;
  grantType: string;
}

export type JWTPayload = {
  iss: string;
  sub: string;
  aud: string[];
  iat: number;
  exp: number;
};

export type Auth0JWTPayload = JWTPayload & {
  role?: string;
  scope: string;
  gty: string;
  azp: string;
};
