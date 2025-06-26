'use client';

import { useParams, usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { SidebarItem } from './sidebar-link';

interface SmartSidebarProps {
  orgSidebarItems: (orgId: string) => SidebarItem[];
  projectSidebarItems: (orgId: string, projectId: string) => SidebarItem[];
}

export function SmartSidebar({ orgSidebarItems, projectSidebarItems }: SmartSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  
  // Determine if we're in a project context by checking if the path contains /project/
  const isProjectContext = pathname.includes('/project/') && projectId;
  
  // Get the appropriate sidebar items
  const sidebarItems = isProjectContext 
    ? projectSidebarItems(orgId, projectId)
    : orgSidebarItems(orgId);
    
  // Use consistent storage key for all sidebars
  const storageKey = 'miot_sidebar';
  
  return <Sidebar items={sidebarItems} storageKey={storageKey} />;
}