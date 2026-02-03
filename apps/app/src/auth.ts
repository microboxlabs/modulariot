import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
/* import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
 */
import { authConfig } from "./auth.config";

const nextAuth: NextAuthResult = NextAuth({
  ...authConfig,
});

export const auth = nextAuth.auth;
// Type annotation to avoid pnpm phantom dependency type inference issues
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const { GET, POST } = nextAuth.handlers;
