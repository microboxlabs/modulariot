import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInWithCredentials } from "@/features/auth/services/auth.service";
import type { SignInCredentials } from "@/features/auth/services/auth.service.types";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { NextResponse } from "next/server";
import { createManagedLogger } from "./lib/logger";
import {
  processMicrosoftEntraAccount,
  processTokenRefresh,
  cleanupRefreshTokens,
} from "@/features/auth/providers/entra-token/entra-token-ecm.service";

// Create hierarchical auth loggers for better management
const authLogger = createManagedLogger("auth", "Authentication System");
const authJwtLogger = createManagedLogger("auth.jwt", "JWT Processing", undefined, "auth");
const authSessionLogger = createManagedLogger("auth.session", "Session Management", undefined, "auth");
const authProviderLogger = createManagedLogger("auth.providers", "Auth Providers", undefined, "auth");
const authMicrosoftLogger = createManagedLogger("auth.providers.microsoft", "Microsoft Entra ID", undefined, "auth.providers");
const authCredentialsLogger = createManagedLogger("auth.providers.credentials", "Credentials Auth", undefined, "auth.providers");
const authAuthzLogger = createManagedLogger("auth.authorization", "Route Authorization", undefined, "auth");

export const authConfig = {
  // basePath: "/app/api/auth",
  pages: {
    signIn: "/app/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      try {
        const nextUrl = new URL(request.nextUrl);
        
        authAuthzLogger.debug({
          path: nextUrl.pathname,
          hasAuth: !!auth,
          hasUser: !!auth?.user,
        }, "Authorization check");

        if (
          nextUrl.pathname.endsWith("/sign-in") ||
          nextUrl.pathname.endsWith("/totem") ||
          nextUrl.pathname == "/app/favicon.ico" ||
          nextUrl.pathname.endsWith("/app/release") ||
          nextUrl.pathname.includes("/release/")
        ) {
          authAuthzLogger.debug( { path: nextUrl.pathname }, "Public route access granted");
          return;
        }

        const isLoggedIn = !!auth?.user;
        if (!isLoggedIn) {
          authAuthzLogger.info({
            path: nextUrl.pathname,
            redirectTo: "/app/sign-in",
            newUrl: new URL("/app/sign-in", nextUrl).toString(),
          }, "Unauthorized access attempt, redirecting to sign-in");
          return NextResponse.redirect(new URL("/app/sign-in", nextUrl));
        }

        authAuthzLogger.debug( { 
          path: nextUrl.pathname,
          userId: auth?.user?.id 
        }, "Authorization successful");
        return true;
      } catch (error) {
        authAuthzLogger.error({ error }, "Error in authorized callback");
        return false;
      }
    },
    async jwt({ token, user, account }) {
      try {
        authJwtLogger.debug({
          provider: account?.provider,
          hasAccount: !!account,
          hasUser: !!user,
          tokenSub: token.sub,
          expiresAt: token?.expiresAt,
          rawJWT: token?.rawJWT,
        }, "JWT callback triggered");

        // When user signs in with OAuth providers (like Microsoft Entra ID)
        if (account && account.provider === "microsoft-entra-id") {
          token = await processMicrosoftEntraAccount(token, account, user, authJwtLogger);
        }

        // Attempt rotation for OAuth tokens on subsequent invocations
        const rotatedToken = await processTokenRefresh(token, authJwtLogger);
        token.rawJWT = rotatedToken.rawJWT;
        token.accessTokenExpiresAt = rotatedToken.accessTokenExpiresAt;
        // Handle credentials provider
        if (account && account.provider === "credentials") {
            authCredentialsLogger.debug( {
              hasUser: !!user,
              email: user?.email,
            }, "Processing credentials-based authentication");
      

          if (user) {
            token.ticket = user.ticket;
            token.rawJWT = undefined;
            authJwtLogger.debug( {
              email: user.email,
              hasTicket: !!user.ticket,
              provider: account?.provider,
              ticket: token.ticket,
              rawJWT: token.rawJWT,
            }, "Processing user in JWT callback");
            
          }
        }

        return token;
      } catch (error) {
        authJwtLogger.error({ error }, "Error in JWT callback");
        // Re-throw to let NextAuth handle it
        throw error;
      }
    },
    session({ session, token }) {
      try {
        // authSessionLogger.debug( {
        //   hasSession: !!session,
        //   hasToken: !!token,
        //   hasTicket: !!token?.ticket,
        //   tokenSub: token?.sub,
        //   accessTokenExpiresAt: token?.accessTokenExpiresAt,
        //   rawJWT: token?.rawJWT,
        // }, "Session callback triggered");

        if (token && !token.ticket) {
          const expiresAt = token.accessTokenExpiresAt ?? 0;
          const expiresAtMs = expiresAt * 1000;
          const now = Date.now();
          authSessionLogger.debug( {
            expiresAt: expiresAt,
            isValid: expiresAtMs  > now,
            hasRawJWT: !!(token as any).rawJWT,
          }, "Processing OAuth token");

          if (expiresAtMs > now) {
            session.user.ticket = undefined;
            session.user.id = token.sub as string;
            // Make raw JWT available in session
            (session.user as any).rawJWT = (token as any).rawJWT;
            // (session.user as any).accessToken = (token as any).accessToken;

            authSessionLogger.debug( {
              sub: token.sub,
              email: session.user.email,
            }, "Session created successfully for OAuth user");
          } else {
            authSessionLogger.warn( {
              expiresAt: expiresAt,
              tokenSub: token.sub,
            }, "Token expired, returning empty session");
            return {
              user: undefined,
              expires: new Date(expiresAtMs).toISOString(),
            };
          }
        } else if (token.ticket) {
          authSessionLogger.debug( {
            userId: token.sub,
            hasTicket: !!token.ticket,
          }, "Processing ticket-based session");
          session.user.ticket = token.ticket as string;
          session.user.id = token.sub as string;
        }

        authSessionLogger.debug( {
          userId: session.user?.email,
          hasTicket: !!session.user?.ticket,
        }, "Session created successfully");

        // Propagate refresh error to session for UI/flow control
        (session as any).error = (token as any).error;
        return session;
      } catch (error) {
        authSessionLogger.error({ error }, "Error in session callback");
        // Return a safe session instead of throwing
        return {
          user: undefined,
          expires: new Date().toISOString(),
        };
      }
    },
  },

  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email User.Read offline_access",
        },
      },
    }),
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        return signInWithCredentials(credentials as SignInCredentials);
      },
    }),
  ],

  logger: {
    error(error: Error) {
      // authLogger.error(error);
    },
    warn(code: string) {
      // authLogger.warn(code);
    },
    debug(code: string, ...message: any[]) {
      // authLogger.debug(message, code);
    },
  },
  
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (account?.provider === "microsoft-entra-id") {
        authMicrosoftLogger.info( {
          userId: user.id,
          email: user.email,
          isNewUser,
        }, "User signed in via Microsoft Entra ID");
      } else if (account?.provider === "credentials") {
        authCredentialsLogger.info( {
          userId: user.id,
          email: user.email,
          isNewUser,
        }, "User signed in via credentials");
      }
    },
    async signOut(message) {
      const userId = 'session' in message ? (message.session as any)?.user?.id : message.token?.sub;
      const session = 'session' in message ? message.session : null;
      
      authLogger.info( {
        userId,
        timestamp: new Date().toISOString(),
      }, "User signed out");

      // Clean up refresh tokens from ECM on sign-out
      if (session && (session as any)?.user) {
        try {
          await cleanupRefreshTokens(session as any);
          authLogger.debug({ userId }, "Cleaned up refresh tokens from ECM on sign-out");
        } catch (error) {
          authLogger.warn({ error, userId }, "Failed to cleanup refresh tokens from ECM on sign-out");
        }
      }
    },
    async session({ session, token }) {
      // authSessionLogger.debug( {
      //   userId: session?.user?.email,
      //   expires: session?.expires,
      // }, "Session accessed");
    },
  },
} satisfies NextAuthConfig;
