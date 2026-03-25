import { LayoutDashboard, Users, CreditCard, BarChart, Settings } from 'lucide-react';
import { SidebarItem } from '@modulariot/ui/sidebar-link';

export const getSidebarItems = (orgId: string): SidebarItem[] => [
  {
    label: 'Overview',
    href: `/org/${orgId}`,
    icon: LayoutDashboard,
  },
  {
    label: 'Teams',
    href: `/org/${orgId}/teams`,
    icon: Users,
  },
  {
    label: 'Billing',
    href: `/org/${orgId}/billing`,
    icon: CreditCard,
  },
  {
    label: 'Usage',
    href: `/org/${orgId}/usage`,
    icon: BarChart,
  },
  {
    label: 'Settings',
    href: `/org/${orgId}/settings`,
    icon: Settings,
  },
];