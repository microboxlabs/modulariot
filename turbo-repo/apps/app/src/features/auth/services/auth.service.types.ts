import type { DefaultSession } from "next-auth";
import { z } from "zod";

export type SignInCredentials = {
  email: string;
  password: string;
};

export type AuthenticateActionState = {
  success?: boolean;
  message?: string;
  status?: number;
  dataErrors?: DataAuthenticationError;
};

export type DataAuthenticationError = {
  email?: string | string[];
  password?: string | string[];
};

export const formSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Description should be at least 8 characters long"),
});
export type FormSchema = z.infer<typeof formSchema>;

// types/next-auth.d.ts

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user?: {
      /** The user's role. */
      ticket?: string;
      accessToken?: string;
      rawJWT?: string;
    } & DefaultSession["user"];
  }
  interface User {
    ticket?: string;
    accessToken?: string;
    rawJWT?: string;
  }
}
