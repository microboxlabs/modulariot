'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, RadioTower, Thermometer, CreditCard, Settings } from 'lucide-react';
import { Tooltip } from 'flowbite-react';

const navItems = [
  { href: '/org', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/org/devices', label: 'Devices', icon: RadioTower },
  { href: '/org/symptoms', label: 'Symptoms', icon: Thermometer },
  { href: '/org/billing', label: 'Billing', icon: CreditCard },
  { href: '/org/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block w-16 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-2">
      <nav className="flex flex-col items-center gap-4 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && (item.href !== '/org' || pathname === '/org');
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
