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
