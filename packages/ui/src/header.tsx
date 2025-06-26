'use client';

import React from 'react';
import { DarkThemeToggle } from 'flowbite-react';
import { Logo } from './Logo';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatar?: string;
}

interface HeaderProps {
  user: User;
  onSignOut?: () => void | Promise<void>;
  logoSize?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export function Header({ 
  user, 
  onSignOut,
  logoSize = "xs",
  className = "",
  children
}: HeaderProps) {
  const handleAvatarClick = async () => {
    if (onSignOut) {
      try {
        await onSignOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  };

  return (
    <header className={`border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Logo size={logoSize} />
            {children}
          </div>
          
          <div className="flex items-center gap-4">
            <DarkThemeToggle />
            
            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              </div>
              
              <div 
                className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors"
                onClick={handleAvatarClick}
                title="Click to sign out"
              >
                <span className="text-white text-sm font-medium">
                  {(user.name || user.email)?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 