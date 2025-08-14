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
      if (nextUrl.pathname.endsWith("/sign-in") || nextUrl.pathname.endsWith("/totem")) {
        return;
      }

      const isLoggedIn = !!auth?.user;
      if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/app/sign-in", nextUrl));
      }

      return true;
    },
    async jwt({ token, user, account }) {
      // When user signs in with OAuth providers (like Microsoft Entra ID)
      if (account && account.provider === "microsoft-entra-id") {
        // Raw JWT token from Microsoft Entra ID
        token.rawJWT = account.id_token;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        
        // You can also decode and access JWT claims
        // Note: The id_token is already a JWT, no need to decode unless you want specific claims
        console.log("Raw Microsoft Entra ID JWT:", account.id_token);
        console.log("Access Token:", account.access_token);
        // console.log("Refresh Token:", account.refresh_token);
      }
      
      if (user) {
        token.ticket = user.ticket;        
      }
      return token;
    },
    session({ session, token }) {
      if (token && !token.ticket) {
        var expiresAt = new Date((token.exp?? 0) * 1000);
        if (expiresAt > new Date()) {
          session.user.ticket = token.ticket as string;
          session.user.id = token.sub as string;
          // Make raw JWT available in session
          (session.user as any).rawJWT = (token as any).rawJWT;
          (session.user as any).accessToken = (token as any).accessToken;
        }
        else {
          return {
            user: undefined,
            expires: new Date().toISOString(),
          };
        }
      }
      else if(token.ticket) {
        session.user.ticket = token.ticket as string;
        session.user.id = token.sub as string;  
      }
      return session;
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
