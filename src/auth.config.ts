import { sign } from 'crypto';
import  { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { signInWithCredentials } from '@/features/auth/services/auth.service';
import type { SignInCredentials } from '@/features/auth/services/auth.service.types';

export const authConfig = {
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    authorized({ auth, request }) {
      const nextUrl = new URL(request.nextUrl);
      if (nextUrl.pathname.endsWith('/sign-in')) {
        return;
      }

      const isLoggedIn = !!auth?.user;
      if(!isLoggedIn) {
        return Response.redirect(new URL('/sign-in', nextUrl));
      }

      return true;
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
      authorize: signInWithCredentials,
    }),
  ],
} satisfies NextAuthConfig;