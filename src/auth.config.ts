import { sign } from 'crypto';
import  { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { signInWithCredentials } from '@/features/auth/services/auth.service';
import type { SignInCredentials } from '@/features/auth/services/auth.service.types';
import credentials from 'next-auth/providers/credentials';

export const authConfig = {
  pages: {
    signIn: '/app/sign-in',
  },
  callbacks: {
    authorized({ auth, request }) {
      const nextUrl = new URL(request.nextUrl);
      if (nextUrl.pathname.endsWith('/sign-in')) {
        return;
      }

      const isLoggedIn = !!auth?.user;
      if(!isLoggedIn) {
        return Response.redirect(new URL('/app/sign-in', nextUrl));
      }

      return true;
    },
    jwt ({token, user}) {
      if (user) {
        token.ticket = user.ticket;
      }
      return token;
    },
    session ({ session, token }) {
      if (token) {
        session.user.ticket = token.ticket as string;
        session.user.id = token.sub as string;
      }
      return session;
    }
  },
    
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        return signInWithCredentials(credentials as SignInCredentials);
      }
    }),
  ],
} satisfies NextAuthConfig;