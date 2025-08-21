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
          nextUrl.pathname.endsWith("/totem") ||
          nextUrl.pathname == "/app/favicon.ico" ||
          nextUrl.pathname.endsWith("/app/release")
        ) {
          authAuthzLogger.debug( { path: nextUrl.pathname }, "Public route access granted");
          return;
        }

        const isLoggedIn = !!auth?.user;
        if (!isLoggedIn) {
          authAuthzLogger.info("Unauthorized access attempt, redirecting to sign-in", {
            path: nextUrl.pathname,
            redirectTo: "/app/sign-in",
            newUrl: new URL("/app/sign-in", nextUrl).toString(),
          });
          return NextResponse.redirect(new URL("/app/sign-in", nextUrl));
        }

        authAuthzLogger.debug( { 
          path: nextUrl.pathname,
          userId: auth?.user?.id 
        }, "Authorization successful");
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
          authMicrosoftLogger.debug( {
            accountId: account.providerAccountId,
            hasIdToken: !!account.id_token,
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            idTokenLength: account.id_token?.length,
            accessTokenLength: account.access_token?.length,
            refreshTokenLength: account.refresh_token?.length,
          }, "Processing Microsoft Entra ID account");

          // Raw JWT token from Microsoft Entra ID
          token.rawJWT = account.id_token;
          token.ticket = null;
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;

          authMicrosoftLogger.debug({
            accessTokenPreview: account.access_token?.slice(0, 16),
            refreshTokenPreview: account.refresh_token?.slice(0, 16),
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
          }, "Stored provider tokens on JWT (previews shown; full only in dev)");

          authMicrosoftLogger.debug( {
            rawJWT: token.rawJWT,
            ticket: token.ticket,
          }, "Tokens stored in JWT callback successfully");
        }

        // Handle credentials provider
        if (account && account.provider === "credentials") {
            authCredentialsLogger.debug( {
              hasUser: !!user,
              email: user?.email,
            }, "Processing credentials-based authentication");
      

          if (user) {
            token.ticket = user.ticket;
            token.rawJWT = null;
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
        authJwtLogger.error("Error in JWT callback:", error);
        // Re-throw to let NextAuth handle it
        throw error;
      }
    },
    session({ session, token }) {
      try {
        authSessionLogger.debug( {
          hasSession: !!session,
          hasToken: !!token,
          hasTicket: !!token?.ticket,
          tokenSub: token?.sub,
        }, "Session callback triggered");

        if (token && !token.ticket) {
          var expiresAt = new Date((token.exp ?? 0) * 1000);
          authSessionLogger.debug( {
            expiresAt: expiresAt.toISOString(),
            isValid: expiresAt > new Date(),
            hasRawJWT: !!(token as any).rawJWT,
          }, "Processing OAuth token");

          if (expiresAt > new Date()) {
            session.user.ticket = token.ticket as string;
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
              expiresAt: expiresAt.toISOString(),
              tokenSub: token.sub,
            }, "Token expired, returning empty session");
            return {
              user: undefined,
              expires: new Date().toISOString(),
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
      authLogger.error(error);
    },
    warn(code: string) {
      authLogger.warn(code);
    },
    debug(code: string, ...message: any[]) {
      authLogger.debug(message, code);
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
      authLogger.info( {
        userId,
        timestamp: new Date().toISOString(),
      }, "User signed out");
    },
    async session({ session, token }) {
      authSessionLogger.debug( {
        userId: session?.user?.email,
        expires: session?.expires,
      }, "Session accessed");
    },
  },
} satisfies NextAuthConfig;
