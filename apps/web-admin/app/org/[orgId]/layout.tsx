'use client';

import { SmartSidebar } from '@modulariot/ui/smart-sidebar';
import { getSidebarItems } from '../../components/sidebarData';
import { getProjectSidebarItems } from '../../components/projectSidebarData';

export default function OrgDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <SmartSidebar 
        orgSidebarItems={getSidebarItems}
        projectSidebarItems={getProjectSidebarItems}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="container px-6 mx-auto py-8">
          {children}
        </div>
      </main>
    </div>
  );
} 