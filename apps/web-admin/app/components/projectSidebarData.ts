import { 
  LayoutDashboard, 
  Truck, 
  Cpu, 
  Bot, 
  Radar, 
  Users, 
  FileBarChart, 
  List, 
  BookOpen, 
  Settings 
} from 'lucide-react';
import { SidebarItem } from '@modulariot/ui/sidebar-link';

export const getProjectSidebarItems = (orgId: string, projectId: string): SidebarItem[] => [
  {
    label: 'Overview',
    href: `/org/${orgId}/project/${projectId}`,
    icon: LayoutDashboard,
  },
  {
    label: 'Fleets',
    href: `/org/${orgId}/project/${projectId}/fleets`,
    icon: Truck,
  },
  {
    label: 'Devices',
    href: `/org/${orgId}/project/${projectId}/devices`,
    icon: Cpu,
  },
  {
    label: 'Symptom Agent',
    href: `/org/${orgId}/project/${projectId}/agent`,
    icon: Bot,
  },
  {
    label: 'Mission Control',
    href: `/org/${orgId}/project/${projectId}/mission`,
    icon: Radar,
  },
  {
    label: 'Advisors',
    href: `/org/${orgId}/project/${projectId}/advisors`,
    icon: Users,
  },
  {
    label: 'Reports',
    href: `/org/${orgId}/project/${projectId}/reports`,
    icon: FileBarChart,
  },
  {
    label: 'Logs',
    href: `/org/${orgId}/project/${projectId}/logs`,
    icon: List,
  },
  {
    label: 'API Docs',
    href: `/org/${orgId}/project/${projectId}/docs`,
    icon: BookOpen,
  },
  {
    label: 'Project Settings',
    href: `/org/${orgId}/project/${projectId}/settings`,
    icon: Settings,
  },
];