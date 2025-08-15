import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInWithCredentials } from "@/features/auth/services/auth.service";
import type { SignInCredentials } from "@/features/auth/services/auth.service.types";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { NextResponse } from "next/server";

export const authConfig = {
  // basePath: "/app/api/auth",
  pages: {
    signIn: "/app/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      const nextUrl = new URL(request.nextUrl);
      if (
        nextUrl.pathname.endsWith("/sign-in") ||
        nextUrl.pathname.endsWith("/totem")
      ) {
        return;
      }

      const isLoggedIn = !!auth?.user;
      if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/app/sign-in", nextUrl));
      }

      return true;
    },
    async jwt({ token, user, account }) {
      try {
        console.log("JWT callback triggered", {
          provider: account?.provider,
          hasAccount: !!account,
          hasUser: !!user,
          tokenSub: token.sub,
        });

        // When user signs in with OAuth providers (like Microsoft Entra ID)
        if (account && account.provider === "microsoft-entra-id") {
          console.log("Processing Microsoft Entra ID account", {
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

          console.log("Tokens stored in JWT callback successfully");
        }

        if (user) {
          console.log("Processing user in JWT callback", {
            userId: user.id,
            hasTicket: !!user.ticket,
          });
          token.ticket = user.ticket;
        }

        return token;
      } catch (error) {
        console.error("Error in JWT callback:", error);
        // Re-throw to let NextAuth handle it
        throw error;
      }
    },
    session({ session, token }) {
      try {
        console.log("Session callback triggered", {
          hasSession: !!session,
          hasToken: !!token,
          hasTicket: !!token?.ticket,
          tokenSub: token?.sub,
        });

        if (token && !token.ticket) {
          var expiresAt = new Date((token.exp ?? 0) * 1000);
          console.log("Processing non-ticket token", {
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

            console.log("Session created successfully for OAuth user");
          } else {
            console.log("Token expired, returning empty session");
            return {
              user: undefined,
              expires: new Date().toISOString(),
            };
          }
        } else if (token.ticket) {
          console.log("Processing ticket-based session");
          session.user.ticket = token.ticket as string;
          session.user.id = token.sub as string;
        }

        return session;
      } catch (error) {
        console.error("Error in session callback:", error);
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
} satisfies NextAuthConfig;
