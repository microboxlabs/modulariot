'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SidebarItem {
  label: string;
  href: string;
  icon: any;
}

interface SidebarLinkProps {
  item: SidebarItem;
  isCollapsed: boolean;
}

export function SidebarLink({ item, isCollapsed }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={`
        flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${isActive 
          ? 'bg-primary-50 dark:bg-slate-800 border-l-4 border-primary-500 text-primary-700 dark:text-primary-300' 
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }
        ${isCollapsed ? 'justify-center' : 'gap-3'}
      `}
      title={isCollapsed ? item.label : undefined}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  );
}