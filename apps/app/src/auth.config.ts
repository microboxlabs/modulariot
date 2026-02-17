import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInWithCredentials } from "@/features/auth/services/auth.service";
import type { SignInCredentials } from "@/features/auth/services/auth.service.types";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Auth0 from "next-auth/providers/auth0"

import { NextResponse } from "next/server";
import { createManagedLogger } from "./lib/logger";
import {
  processMicrosoftEntraAccount,
  processTokenRefresh,
  cleanupRefreshTokens,
} from "@/features/auth/providers/entra-token/entra-token-ecm.service";

/**
 * Builds the list of authentication providers based on available environment variables.
 * Providers are only included if their required credentials are configured.
 */
function buildAuthProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (
    process.env.AUTH_AUTH0_ID &&
    process.env.AUTH_AUTH0_SECRET &&
    process.env.AUTH_AUTH0_ISSUER
  ) {
    providers.push(
      Auth0({
        clientId: process.env.AUTH_AUTH0_ID,
        clientSecret: process.env.AUTH_AUTH0_SECRET,
        issuer: process.env.AUTH_AUTH0_ISSUER,
        authorization: {
          params: {
            // Only include audience if configured (requires API to be authorized for app)
            ...(process.env.AUTH_AUTH0_AUDIENCE && { audience: process.env.AUTH_AUTH0_AUDIENCE }),
            scope: "openid profile email offline_access",
          },
        },
      })
    );
  }

  // Microsoft Entra ID - only add if configured
  if (
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
  ) {
    providers.push(
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        authorization: {
          params: {
            scope: "openid profile email User.Read offline_access",
          },
        },
      })
    );
  }

  

  // Credentials provider - always available
  providers.push(
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
    })
  );

  return providers;
}

// Create hierarchical auth loggers for better management
const authLogger = createManagedLogger("auth", "Authentication System");
const authJwtLogger = createManagedLogger("auth.jwt", "JWT Processing", undefined, "auth");
const authSessionLogger = createManagedLogger("auth.session", "Session Management", undefined, "auth");
const authMicrosoftLogger = createManagedLogger("auth.providers.microsoft", "Microsoft Entra ID", undefined, "auth.providers");
const authCredentialsLogger = createManagedLogger("auth.providers.credentials", "Credentials Auth", undefined, "auth.providers");
const authAuth0Logger = createManagedLogger("auth.providers.auth0", "Auth0 OIDC", undefined, "auth.providers");
const authAuthzLogger = createManagedLogger("auth.authorization", "Route Authorization", undefined, "auth");

export const authConfig: NextAuthConfig = {
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
          nextUrl.pathname.endsWith("/favicon.ico") ||
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

        // Attempt rotation for OAuth tokens on subsequent invocations (Microsoft Entra ID only)
        const isMicrosoftConfigured = !!(
          process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
          process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
          process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
        );
        if (isMicrosoftConfigured && token.refreshToken && !account) {
          const rotatedToken = await processTokenRefresh(token, authJwtLogger);
          token.rawJWT = rotatedToken.rawJWT;
          token.accessTokenExpiresAt = rotatedToken.accessTokenExpiresAt;
        }

        // When user signs in with Auth0 (Google, GitHub, or Auth0 credentials)
        if (account?.provider === "auth0") {
          authAuth0Logger.debug({
            hasAccessToken: !!account.access_token,
            hasIdToken: !!account.id_token,
            hasRefreshToken: !!account.refresh_token,
            expiresAt: account.expires_at,
          }, "Processing Auth0 authentication");

          // Store Auth0 access token for backend API authorization
          // With audience configured, access_token is a JWT meant for the API (ECM)
          token.rawJWT = account.id_token;
          token.accessTokenExpiresAt = account.expires_at;
          token.refreshToken = account.refresh_token;

          // Store user info from initial sign-in
          if (user) {
            token.name = user.name;
            token.email = user.email;
            token.picture = user.image;
          }

          authAuth0Logger.debug({
            email: token.email,
            hasRawJWT: !!token.rawJWT,
            expiresAt: token.accessTokenExpiresAt,
          }, "Auth0 tokens stored in JWT");
        }

        // Attempt rotation for OAuth tokens on subsequent invocations
        
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

  providers: buildAuthProviders(),

  logger: {
    error(error: Error) {
      // Log the cause which contains the actual error details
      const cause = (error as any).cause;
      authLogger.error({
        error,
        message: error.message,
        cause: cause?.message || cause,
        causeStack: cause?.stack,
      }, "NextAuth error");
      console.error("[NextAuth Error]", error);
      if (cause) {
        console.error("[NextAuth Error Cause]", cause);
      }
    },
    warn(code: string) {
      authLogger.warn({ code }, "NextAuth warning");
      console.warn("[NextAuth Warning]", code);
    },
    debug(code: string, ...message: any[]) {
      authLogger.debug({ code, message }, "NextAuth debug");
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
      } else if (account?.provider === "auth0") {
        // Auth0 profile contains connection info to identify the identity provider
        const connection = profile?.sub?.split("|")[0] ?? "auth0";
        authAuth0Logger.info({  
          userId: user.id,
          email: user.email,
          connection,
          isNewUser,
        }, "User signed in via Auth0");
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
