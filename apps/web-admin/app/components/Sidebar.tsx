'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { LayoutDashboard, FolderOpen, RadioTower, Thermometer, CreditCard, Settings } from 'lucide-react';
import { Tooltip } from 'flowbite-react';

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params?.orgId as string;

  // If we're not in an org context, don't show the sidebar
  if (!orgId) {
    return null;
  }

  const navItems = [
    { href: `/org/${orgId}`, label: 'Projects', icon: FolderOpen },
    { href: `/org/${orgId}/devices`, label: 'Devices', icon: RadioTower },
    { href: `/org/${orgId}/symptoms`, label: 'Symptoms', icon: Thermometer },
    { href: `/org/${orgId}/billing`, label: 'Billing', icon: CreditCard },
    { href: `/org/${orgId}/settings`, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:block w-16 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-2">
      <nav className="flex flex-col items-center gap-4 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== `/org/${orgId}`);
          return (
            <Tooltip content={item.label} placement="right" key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                className={`p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="h-6 w-6" />
              </Link>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
