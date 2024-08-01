import type { DefaultSession } from "next-auth";

export type SignInCredentials = {
  email: string;
  password: string;
};

export type AuthenticateActionState = {
  success?: boolean;
  message?: string;
  status?: number;
};

// types/next-auth.d.ts

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's role. */
      ticket: string;
    } & DefaultSession["user"];
  }
  interface User {
    ticket: string;
  }
}
