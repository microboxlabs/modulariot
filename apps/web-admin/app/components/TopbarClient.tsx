'use client'

import Link from 'next/link';
import { Avatar, Badge, Dropdown, DropdownHeader, DropdownItem, DropdownDivider } from 'flowbite-react';
import { signOut } from 'next-auth/react';
import { Logo } from './Logo';
import { DarkModeToggle } from './DarkModeToggle';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatar?: string;
}

interface TopbarClientProps {
  version: string;
  user: User;
}

export default function TopbarClient({ version, user }: TopbarClientProps) {
  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const avatarUrl = user.image || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-4">
          <Logo size="xs"/>
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white hidden sm:block">
          Organizations
        </h1>

        <div className="flex items-center gap-4">
          <DarkModeToggle />
          <Badge color="cyan" size="sm">v{version}</Badge>
          <Dropdown
            arrowIcon={false}
            inline
            label={<Avatar alt="User settings" img={avatarUrl} rounded size="sm" />}
          >
            <DropdownHeader>
              <span className="block text-sm">{user.name}</span>
              <span className="block truncate text-sm font-medium">{user.email}</span>
            </DropdownHeader>
            <DropdownItem as={Link} href="/org/settings">Settings</DropdownItem>
            <DropdownDivider />
            <DropdownItem onClick={handleSignOut}>Sign out</DropdownItem>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}