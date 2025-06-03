import NextAuth from "next-auth";
/* import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
 */
import { authConfig } from "./auth.config";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
export const {
  auth,
  signIn,
  signOut,
  handlers: { GET, POST },
} = NextAuth({
  ...authConfig,
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
/* export const {
  auth,
  signIn,
  signOut,
  handlers: { GET, POST },
} = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(_credentials) {
        // Add your authentication logic here
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Get user groups directly from API
        const response = await fetch("/api/user/groups");
        const userGroups = await response.json();

        return {
          ...token,
          id: user.id,
          email: user.email,
          name: user.name,
          groups: userGroups || [],
        } as JWT;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          groups: token.groups,
        },
      };
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/error",
  },
}); */
