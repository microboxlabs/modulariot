'use client';

import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { Header } from '@modulariot/ui/header';

export function Topbar() {
  const { data: session } = useSession();
  
  // TODO: Replace with actual user session data
  const user = session?.user

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <Header 
      user={user} 
      onSignOut={handleSignOut}
    />
  );
}
