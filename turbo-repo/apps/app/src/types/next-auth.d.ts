import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      email: string;
      name: string;
      groups: string[];
      rawJWT?: string;
      accessToken?: string;
    };
    error?: "RefreshTokenError";
  }

  interface User {
    id: string;
    email: string;
    name: string;
    groups: string[];
    /** Auth0 id_token from the password-realm grant (credentials via Auth0). */
    idToken?: string;
    refreshToken?: string;
    /** Epoch seconds when the access token expires (from `expires_in`). */
    expiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    groups: string[];
    rawJWT?: string;
    accessToken?: string;
    refreshToken?: string;
    /** Epoch seconds: the earlier of the id_token and access token expiries. */
    expiresAt?: number;
    /** Only present in sessions saved before `expiresAt` existed. */
    accessTokenExpiresAt?: number;
    error?: "RefreshTokenError";
  }
}
