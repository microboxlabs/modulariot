import "server-only";

import {
  Auth0JWTPayload,
  AuthTokenConfig,
  TokenData,
} from "./streamhub-api.types";

export class AuthToken {
  private clientId: string;
  private clientSecret: string;
  private audience: string;
  private grantType: string;
  private token: string | null;
  private expiry: Date | null;
  private tokenRequest: Promise<string> | null;

  constructor(config: AuthTokenConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.audience = config.audience;
    this.grantType = config.grantType;
    this.token = null;
    this.expiry = null;
    this.tokenRequest = null;
  }

  private async _fetchToken(): Promise<TokenData> {
    const endpoint = "https://api.microboxlabs.com/api/v1/login";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
        grant_type: this.grantType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Request failed with status ${response.status}: ${errorData}`,
      );
    }

    return (await response.json()) as TokenData;
  }

  private _isTokenExpired(): boolean {
    return !this.expiry || new Date() > this.expiry;
  }

  private jwtDecode(token: string): Auth0JWTPayload {
    const base64 = token.split(".")[1];
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonPayload) as Auth0JWTPayload;
  }

  public async getToken(): Promise<string> {
    if (!this.token || this._isTokenExpired()) {
      if (this.tokenRequest) {
        return this.tokenRequest;
      }

      // Create new request
      this.tokenRequest = this._fetchToken()
        .then((tokenData) => {
          this.token = tokenData.access_token;
          const decodedToken = this.jwtDecode(this.token);
          this.expiry = new Date(decodedToken.exp * 1000);
          this.tokenRequest = null;
          return this.token;
        })
        .catch((error) => {
          this.tokenRequest = null;
          throw error;
        });
      return this.tokenRequest;
    }
    return this.token;
  }
}
export default AuthToken;
export type { AuthTokenConfig };
