'use client';

import { useState, useEffect } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SidebarLink, SidebarItem } from './sidebar-link';

interface SidebarProps {
  items: SidebarItem[];
  storageKey: string;
}

export function Sidebar({ items, storageKey }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, [storageKey]);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(storageKey, JSON.stringify(newValue));
  };

  return (
    <div
      className={`
        flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-full transition-all duration-300
        ${isCollapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Toggle Button */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}