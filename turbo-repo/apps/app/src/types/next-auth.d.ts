import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      email: string;
      name: string;
      groups: string[];
      ticket?: string;
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
    ticket?: string;
    /** Auth0 id_token from the password-realm grant (credentials via Auth0). */
    idToken?: string;
    refreshToken?: string;
    /** Epoch seconds when idToken expires. */
    expiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    groups: string[];
    ticket?: string;
    rawJWT?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: "RefreshTokenError";
  }
}
