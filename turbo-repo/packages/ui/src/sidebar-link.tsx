'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

export interface SidebarItem {
  label: string;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}

interface SidebarLinkProps {
  item: SidebarItem;
  isCollapsed: boolean;
}

export function SidebarLink({ item, isCollapsed }: SidebarLinkProps) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params?.orgId as string;
  const projectId = params?.projectId as string;
  let isActive = false;
  if (item.href === `/org/${orgId}`) {
    isActive = pathname === item.href;
  } else if (item.href === `/org/${orgId}/project/${projectId}`) {
    isActive = pathname === item.href;
  } else {
    isActive = pathname.startsWith(item.href) && item.href !== `/org/${orgId}` && item.href !== `/org/${orgId}/project/${projectId}`;
  }

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