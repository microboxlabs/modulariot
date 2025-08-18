import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInWithCredentials } from "@/features/auth/services/auth.service";
import type { SignInCredentials } from "@/features/auth/services/auth.service.types";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { NextResponse } from "next/server";
import { createManagedLogger } from "./lib/logger";

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
      
      authAuthzLogger.debug("Authorization check", {
        path: nextUrl.pathname,
        hasAuth: !!auth,
        hasUser: !!auth?.user,
      });

      if (
        nextUrl.pathname.endsWith("/sign-in") ||
        nextUrl.pathname.endsWith("/totem")
      ) {
        authAuthzLogger.debug("Public route access granted", { path: nextUrl.pathname });
        return;
      }

      const isLoggedIn = !!auth?.user;
      if (isLoggedIn) {
        authAuthzLogger.info("Unauthorized access attempt, redirecting to sign-in", {
          path: nextUrl.pathname,
          redirectTo: "/app/sign-in",
          newUrl: new URL("/app/sign-in", nextUrl),
        });
        return NextResponse.redirect(new URL("/app/sign-in", nextUrl));
      }

      authAuthzLogger.debug("Authorization successful", { 
        path: nextUrl.pathname,
        userId: auth?.user?.id 
      });
      return true;
      } catch (error) {
        authAuthzLogger.error("Error in authorized callback", { error });
        return false;
      }
    },
    async jwt({ token, user, account }) {
      try {
        authJwtLogger.debug("JWT callback triggered", {
          provider: account?.provider,
          hasAccount: !!account,
          hasUser: !!user,
          tokenSub: token.sub,
        });

        // When user signs in with OAuth providers (like Microsoft Entra ID)
        if (account && account.provider === "microsoft-entra-id") {
          authMicrosoftLogger.debug("Processing Microsoft Entra ID account", {
            accountId: account.providerAccountId,
            hasIdToken: !!account.id_token,
            hasAccessToken: !!account.access_token,
            idTokenLength: account.id_token?.length,
            accessTokenLength: account.access_token?.length,
          });

          // Raw JWT token from Microsoft Entra ID
          token.rawJWT = account.id_token;
          // token.accessToken = account.access_token;
          // token.refreshToken = account.refresh_token;

          authMicrosoftLogger.debug("Tokens stored in JWT callback successfully");
        }

        // Handle credentials provider
        if (account && account.provider === "credentials") {
          authCredentialsLogger.debug("Processing credentials-based authentication", {
            hasUser: !!user,
            userId: user?.id,
          });
        }

        if (user) {
          authJwtLogger.debug("Processing user in JWT callback", {
            userId: user.id,
            hasTicket: !!user.ticket,
            provider: account?.provider,
          });
          token.ticket = user.ticket;
        }

        return token;
      } catch (error) {
        authJwtLogger.error("Error in JWT callback:", error);
        // Re-throw to let NextAuth handle it
        throw error;
      }
    },
    session({ session, token }) {
      try {
        authSessionLogger.debug("Session callback triggered", {
          hasSession: !!session,
          hasToken: !!token,
          hasTicket: !!token?.ticket,
          tokenSub: token?.sub,
        });

        if (token && !token.ticket) {
          var expiresAt = new Date((token.exp ?? 0) * 1000);
          authSessionLogger.debug("Processing OAuth token", {
            expiresAt: expiresAt.toISOString(),
            isValid: expiresAt > new Date(),
            hasRawJWT: !!(token as any).rawJWT,
          });

          if (expiresAt > new Date()) {
            session.user.ticket = token.ticket as string;
            session.user.id = token.sub as string;
            // Make raw JWT available in session
            (session.user as any).rawJWT = (token as any).rawJWT;
            (session.user as any).accessToken = (token as any).accessToken;

            authSessionLogger.debug("Session created successfully for OAuth user", {
              userId: token.sub,
            });
          } else {
            authSessionLogger.warn("Token expired, returning empty session", {
              expiresAt: expiresAt.toISOString(),
              tokenSub: token.sub,
            });
            return {
              user: undefined,
              expires: new Date().toISOString(),
            };
          }
        } else if (token.ticket) {
          authSessionLogger.debug("Processing ticket-based session", {
            userId: token.sub,
            hasTicket: !!token.ticket,
          });
          session.user.ticket = token.ticket as string;
          session.user.id = token.sub as string;
        }

        authSessionLogger.debug("Session created successfully", {
          userId: session.user?.id,
          hasTicket: !!session.user?.ticket,
        });

        return session;
      } catch (error) {
        authSessionLogger.error("Error in session callback:", error);
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
      authLogger.error("NextAuth Error", { error: error.message, stack: error.stack });
    },
    warn(code: string) {
      authLogger.warn("NextAuth Warning", { code });
    },
    debug(code: string, ...message: any[]) {
      authLogger.debug("NextAuth Debug", { code, message });
    },
  },
  
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (account?.provider === "microsoft-entra-id") {
        authMicrosoftLogger.info("User signed in via Microsoft Entra ID", {
          userId: user.id,
          email: user.email,
          isNewUser,
        });
      } else if (account?.provider === "credentials") {
        authCredentialsLogger.info("User signed in via credentials", {
          userId: user.id,
          email: user.email,
          isNewUser,
        });
      }
    },
    async signOut(message) {
      const userId = 'session' in message ? (message.session as any)?.user?.id : message.token?.sub;
      authLogger.info("User signed out", {
        userId,
        timestamp: new Date().toISOString(),
      });
    },
    async session({ session, token }) {
      authSessionLogger.debug("Session accessed", {
        userId: session?.user?.id,
        expires: session?.expires,
      });
    },
  },
} satisfies NextAuthConfig;
