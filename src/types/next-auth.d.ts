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
  }

  interface User {
    id: string;
    email: string;
    name: string;
    groups: string[];
    ticket?: string;
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
  }
}
